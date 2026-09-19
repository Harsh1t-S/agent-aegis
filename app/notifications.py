"""Idempotent evaluation completion email delivery through Resend."""
from __future__ import annotations

import html
import hashlib
import os

import httpx
from sqlalchemy.exc import IntegrityError

from .database import SessionLocal, set_session_context
from .models import (
    Agent,
    AgentVersion,
    AuditEvent,
    EvaluationJob,
    NotificationDelivery,
    TestRun,
    Workspace,
    now,
)


def notifications_available() -> bool:
    return bool(os.getenv("RESEND_API_KEY") and os.getenv("RESEND_FROM_EMAIL"))


def send_evaluation_notification(evaluation_id: str, workspace_id: str) -> bool:
    """Send once after every job in an evaluation reaches a terminal state."""
    if not notifications_available():
        return False
    db = SessionLocal()
    try:
        set_session_context(db, worker=True, workspace_id=workspace_id)
        workspace = db.get(Workspace, workspace_id)
        settings = (workspace.settings or {}).get("notifications") or {}
        destination = str(settings.get("email") or "").strip().lower()
        if not settings.get("emailEnabled") or "@" not in destination:
            return False

        active = (
            db.query(EvaluationJob)
            .join(TestRun, TestRun.id == EvaluationJob.test_run_id)
            .filter(
                TestRun.agent_version_id == evaluation_id,
                EvaluationJob.status.in_(["queued", "running", "cancel_requested"]),
            )
            .count()
        )
        if active:
            return False
        version = db.get(AgentVersion, evaluation_id)
        if not version:
            return False
        agent = db.get(Agent, version.agent_id)
        runs = db.query(TestRun).filter_by(agent_version_id=evaluation_id).all()
        errors = sum(run.status == "error" for run in runs)
        canceled = sum(run.status == "canceled" for run in runs)
        completed = sum(run.status == "complete" for run in runs)
        status = "failed" if errors else "canceled" if canceled and not completed else "completed"

        delivery = db.query(NotificationDelivery).filter_by(
            evaluation_id=evaluation_id,
            channel="email",
            destination=destination,
        ).with_for_update().first()
        if delivery and (delivery.status == "sent" or delivery.attempts >= 3):
            return delivery.status == "sent"
        if delivery is None:
            delivery = NotificationDelivery(
                workspace_id=workspace_id,
                evaluation_id=evaluation_id,
                channel="email",
                destination=destination,
            )
            db.add(delivery)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                return False
        delivery.attempts += 1
        delivery.status = "sending"
        delivery.error = None
        db.commit()

        app_url = os.getenv("APP_URL", "").rstrip("/")
        report_url = f"{app_url}/app/evaluations/{evaluation_id}" if app_url else ""
        agent_name = agent.name if agent else "Agent"
        safe_name = html.escape(agent_name)
        safe_label = html.escape(version.version_label)
        summary = f"{completed} completed, {errors} errors, {canceled} canceled"
        payload = {
            "from": os.environ["RESEND_FROM_EMAIL"],
            "to": [destination],
            "subject": f"Aegis evaluation {status}: {agent_name} {version.version_label}",
            "text": (
                f"Aegis evaluation {status}\n\n{agent_name} {version.version_label}\n"
                f"{summary}\n\n{report_url}"
            ),
            "html": (
                "<div style='font-family:Arial,sans-serif;max-width:560px'>"
                f"<h1>Evaluation {html.escape(status)}</h1>"
                f"<p><strong>{safe_name} {safe_label}</strong></p>"
                f"<p>{html.escape(summary)}</p>"
                + (f"<p><a href='{html.escape(report_url)}'>Open the private report</a></p>"
                   if report_url else "")
                + "<p style='color:#667085'>This message contains no prompts, traces, or customer records.</p></div>"
            ),
        }
        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={
                    "Authorization": f"Bearer {os.environ['RESEND_API_KEY']}",
                    "Idempotency-Key": (
                        f"evaluation-{evaluation_id}-"
                        f"{hashlib.sha256(destination.encode()).hexdigest()[:16]}"
                    ),
                },
                timeout=15,
            )
            response.raise_for_status()
            provider_id = str(response.json().get("id") or "")
            result_error = None
        except Exception as exc:  # delivery must never turn a completed run into a failed run
            provider_id = ""
            result_error = f"{type(exc).__name__}: {exc}"[:1000]

        delivery = db.get(NotificationDelivery, delivery.id)
        if result_error:
            delivery.status = "failed"
            delivery.error = result_error
        else:
            delivery.status = "sent"
            delivery.provider_id = provider_id
            delivery.sent_at = now()
            db.add(AuditEvent(
                workspace_id=workspace_id,
                actor_user_id=None,
                action="notification.sent",
                target_type="agent_version",
                target_id=evaluation_id,
                detail={"channel": "email", "status": status},
            ))
        db.commit()
        return not result_error
    finally:
        db.close()
