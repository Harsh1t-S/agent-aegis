"""Operator maintenance commands for retention and expired reservations."""
from __future__ import annotations

import argparse
import json
import os
from datetime import timedelta

from sqlalchemy import func

from .database import SessionLocal, set_session_context
from .models import (
    AgentVersion,
    BillingWebhookEvent,
    EvaluationJob,
    MockEnvironment,
    NotificationDelivery,
    Scenario,
    Subscription,
    TestRun,
    UsageReservation,
    Workspace,
    now,
)


def operations_status() -> dict:
    """Return monitor-friendly queue, delivery and billing health signals."""
    db = SessionLocal()
    try:
        set_session_context(db, worker=True)
        current = now()
        queued = db.query(EvaluationJob).execution_options(
            include_all_workspaces=True).filter_by(status="queued")
        oldest = queued.with_entities(func.min(EvaluationJob.created_at)).scalar()
        oldest_seconds = int(max((current - oldest).total_seconds(), 0)) if oldest else 0
        alert_after = max(int(os.getenv("AEGIS_QUEUE_ALERT_SECONDS", "300")), 1)
        result = {
            "queuedJobs": queued.count(),
            "runningJobs": db.query(EvaluationJob).execution_options(
                include_all_workspaces=True).filter_by(status="running").count(),
            "expiredLeases": db.query(EvaluationJob).execution_options(
                include_all_workspaces=True).filter(
                EvaluationJob.status == "running",
                EvaluationJob.lease_until < current,
            ).count(),
            "oldestQueuedSeconds": oldest_seconds,
            "queueAlertSeconds": alert_after,
            "failedJobs": db.query(EvaluationJob).execution_options(
                include_all_workspaces=True).filter_by(status="failed").count(),
            "exhaustedNotifications": db.query(NotificationDelivery).execution_options(
                include_all_workspaces=True).filter(
                NotificationDelivery.status == "failed",
                NotificationDelivery.attempts >= 3,
            ).count(),
            "failedBillingWebhooks": db.query(BillingWebhookEvent).filter_by(
                status="failed").count(),
            "delinquentSubscriptions": db.query(Subscription).filter(
                Subscription.status.in_(["past_due", "unpaid"]),
            ).count(),
            "expiredReservations": db.query(UsageReservation).execution_options(
                include_all_workspaces=True).filter(
                UsageReservation.status == "reserved",
                UsageReservation.expires_at <= current,
            ).count(),
        }
        result["healthy"] = not any((
            result["expiredLeases"],
            result["failedJobs"],
            result["exhaustedNotifications"],
            result["failedBillingWebhooks"],
            result["oldestQueuedSeconds"] > alert_after,
        ))
        return result
    finally:
        db.close()


def retention(*, apply: bool = False) -> dict[str, int]:
    db = SessionLocal()
    counts = {"workspaces": 0, "evaluations": 0, "scenarios": 0, "reservations_expired": 0}
    try:
        set_session_context(db, worker=True)
        workspaces = db.query(Workspace).execution_options(
            include_all_workspaces=True).all()
        for workspace in workspaces:
            set_session_context(db, workspace_id=workspace.id)
            cutoff = now() - timedelta(days=max(workspace.retention_days, 1))
            versions = db.query(AgentVersion).filter(
                AgentVersion.workspace_id == workspace.id,
                AgentVersion.created_at < cutoff,
            ).all()
            if not versions:
                continue
            counts["workspaces"] += 1
            for version in versions:
                runs = db.query(TestRun).filter_by(
                    agent_version_id=version.id).all()
                scenario_ids = {run.scenario_id for run in runs}
                environment_ids = {
                    value for (value,) in db.query(Scenario.mock_environment_id)
                    .filter(Scenario.id.in_(scenario_ids)).all()
                } if scenario_ids else set()
                counts["evaluations"] += 1
                counts["scenarios"] += len(scenario_ids)
                if not apply:
                    continue
                db.delete(version)  # cascades runs, jobs, traces, findings and reviews
                db.flush()
                if scenario_ids:
                    db.query(Scenario).filter(
                        Scenario.id.in_(scenario_ids)).delete(synchronize_session=False)
                if environment_ids:
                    used = {
                        value for (value,) in db.query(Scenario.mock_environment_id)
                        .filter(Scenario.mock_environment_id.in_(environment_ids)).all()
                    }
                    removable = environment_ids - used
                    if removable:
                        db.query(MockEnvironment).filter(
                            MockEnvironment.id.in_(removable)).delete(
                                synchronize_session=False)
            if apply:
                db.commit()

        expired = db.query(UsageReservation).execution_options(
            include_all_workspaces=True).filter(
                UsageReservation.status == "reserved",
                UsageReservation.expires_at <= now(),
            ).all()
        counts["reservations_expired"] = len(expired)
        if apply:
            for reservation in expired:
                reservation.refunded_units += max(
                    reservation.reserved_units
                    - reservation.settled_units
                    - reservation.refunded_units,
                    0,
                )
                reservation.status = "expired"
            db.commit()
        else:
            db.rollback()
        return counts
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Aegis data maintenance")
    parser.add_argument("command", choices=["retention", "notifications", "status"])
    parser.add_argument("--apply", action="store_true",
                        help="perform deletions; omission is a dry run")
    args = parser.parse_args()
    if args.command == "status":
        result = operations_status()
        print(json.dumps(result, sort_keys=True))
        if not result["healthy"]:
            raise SystemExit(1)
        return
    if args.command == "notifications":
        from .notifications import send_evaluation_notification

        db = SessionLocal()
        try:
            set_session_context(db, worker=True)
            rows = db.query(NotificationDelivery).execution_options(
                include_all_workspaces=True).filter(
                    NotificationDelivery.status.in_(["queued", "sending", "failed"]),
                    NotificationDelivery.attempts < 3,
                ).all()
            targets = [(row.evaluation_id, row.workspace_id) for row in rows]
        finally:
            db.close()
        sent = sum(send_evaluation_notification(*target) for target in targets)
        result = {"eligible": len(targets), "sent": sent}
    else:
        result = retention(apply=args.apply)
    mode = ("retry" if args.command == "notifications" else
            "applied" if args.apply else "dry-run")
    print(f"{mode}: " + ", ".join(f"{key}={value}" for key, value in result.items()))


if __name__ == "__main__":
    main()
