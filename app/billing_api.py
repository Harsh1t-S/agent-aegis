"""Razorpay subscription checkout and idempotent webhook handling."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db, set_session_context
from .models import BillingWebhookEvent, Organization, Subscription, Workspace, now
from .plans import PLANS, plan_for
from .tenancy import WorkspaceContext, audit, current_workspace, require_role
from .usage import usage_summary

router = APIRouter(prefix="/api", tags=["billing"])


class CheckoutIn(BaseModel):
    plan: str


def _credentials() -> tuple[str, str]:
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        raise HTTPException(503, "Billing is not configured yet")
    return key_id, key_secret


def _plan_ids() -> dict[str, str]:
    return {
        "starter": os.getenv("RAZORPAY_STARTER_PLAN_ID", ""),
        "team": os.getenv("RAZORPAY_TEAM_PLAN_ID", ""),
    }


def _razorpay_request(method: str, path: str, *, data: dict | None = None) -> dict:
    try:
        response = httpx.request(
            method,
            f"https://api.razorpay.com/v1/{path.lstrip('/')}",
            json=data,
            auth=_credentials(),
            timeout=15,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Billing provider is temporarily unavailable") from exc
    if response.status_code >= 400:
        try:
            message = response.json()["error"]["description"]
        except Exception:
            message = "Billing provider rejected the request"
        raise HTTPException(502, message)
    return response.json()


def _subscription(db: Session, organization_id: str) -> Subscription:
    row = db.get(Subscription, organization_id)
    if row is None:
        row = Subscription(organization_id=organization_id, provider="razorpay")
        db.add(row)
        db.flush()
    return row


def _checkout_ready() -> bool:
    plans = _plan_ids()
    return bool(os.getenv("RAZORPAY_KEY_ID") and os.getenv("RAZORPAY_KEY_SECRET")
                and plans["starter"] and plans["team"])


@router.get("/billing")
def billing_summary(db: Session = Depends(get_db),
                    context: WorkspaceContext = Depends(current_workspace)):
    subscription = _subscription(db, context.organization_id)
    summary = usage_summary(db, context.workspace_id, context.organization_id)
    plans = _plan_ids()
    return {
        **summary,
        "provider": "razorpay",
        "customerConfigured": bool(subscription.provider_subscription_id),
        "subscriptionId": subscription.provider_subscription_id,
        "cancelAtPeriodEnd": subscription.cancel_at_period_end,
        "checkoutAvailable": _checkout_ready(),
        "plans": [
            {**plan_for(key).payload(), "available": bool(plans.get(key))}
            for key in ("starter", "team")
        ],
    }


@router.post("/billing/checkout")
def create_checkout(
    body: CheckoutIn,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner")
    plan_id = _plan_ids().get(body.plan)
    if body.plan not in {"starter", "team"} or not plan_id:
        raise HTTPException(422, "That subscription plan is not available")
    subscription = _subscription(db, context.organization_id)
    if (subscription.provider_subscription_id
            and subscription.status not in {"canceled", "completed", "expired"}):
        raise HTTPException(409, "This organization already has a subscription")

    organization = db.get(Organization, context.organization_id)
    response = _razorpay_request("POST", "subscriptions", data={
        "plan_id": plan_id,
        "total_count": 120,
        "quantity": 1,
        "customer_notify": True,
        "notes": {
            "organization_id": context.organization_id,
            "plan": body.plan,
            "product": "aegis",
        },
        "notify_info": {
            "notify_email": organization.billing_email or context.principal.email,
        },
    })
    checkout_url = response.get("short_url")
    if not checkout_url:
        raise HTTPException(502, "Razorpay did not return a checkout URL")
    subscription.provider = "razorpay"
    subscription.provider_subscription_id = response["id"]
    subscription.plan = body.plan
    subscription.status = response.get("status", "created")
    audit(db, context, "billing.checkout.created", "organization",
          context.organization_id, {"plan": body.plan, "provider": "razorpay"})
    db.commit()
    return {"url": checkout_url}


@router.post("/billing/portal")
def create_portal(
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner")
    subscription = _subscription(db, context.organization_id)
    if not subscription.provider_subscription_id:
        raise HTTPException(409, "Start a subscription before opening billing")
    remote = _razorpay_request(
        "GET", f"subscriptions/{subscription.provider_subscription_id}")
    url = remote.get("short_url")
    if not url:
        raise HTTPException(409, "This subscription has no customer management link")
    return {"url": url}


def _verify_signature(payload: bytes, signature: str) -> None:
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(503, "Razorpay webhook secret is not configured")
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        raise HTTPException(400, "Invalid Razorpay signature")


def _timestamp(value) -> datetime | None:
    return (datetime.fromtimestamp(value, timezone.utc).replace(tzinfo=None)
            if value else None)


def _entity(event: dict) -> dict:
    payload = event.get("payload") or {}
    return ((payload.get("subscription") or {}).get("entity") or {})


def _organization_for_event(db: Session, obj: dict) -> str | None:
    notes = obj.get("notes") or {}
    if notes.get("organization_id"):
        return notes["organization_id"]
    row = db.query(Subscription).filter_by(
        provider_subscription_id=obj.get("id")).first()
    return row.organization_id if row else None


def _plan_from_subscription(obj: dict) -> str:
    notes = obj.get("notes") or {}
    if notes.get("plan") in PLANS:
        return notes["plan"]
    for plan, configured in _plan_ids().items():
        if configured and configured == obj.get("plan_id"):
            return plan
    return "trial"


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    set_session_context(db, worker=True)
    payload = await request.body()
    _verify_signature(payload, request.headers.get("x-razorpay-signature", ""))
    try:
        event = json.loads(payload)
        event_type = event["event"]
        obj = _entity(event)
    except (KeyError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(400, "Malformed Razorpay event") from exc
    event_id = (request.headers.get("x-razorpay-event-id")
                or hashlib.sha256(payload).hexdigest())

    receipt = db.get(BillingWebhookEvent, event_id)
    if receipt and receipt.status == "processed":
        return {"received": True, "duplicate": True}
    if receipt is None:
        receipt = BillingWebhookEvent(
            id=event_id, provider="razorpay", event_type=event_type, payload=event)
        db.add(receipt)
        db.commit()

    try:
        organization_id = _organization_for_event(db, obj)
        if organization_id and event_type.startswith("subscription."):
            row = _subscription(db, organization_id)
            event_created_at = _timestamp(event.get("created_at"))
            if (event_created_at and row.provider_event_created_at
                    and event_created_at < row.provider_event_created_at):
                receipt.status = "processed"
                receipt.processed_at = now()
                db.commit()
                return {"received": True, "ignored": "stale_event"}
            row.provider = "razorpay"
            row.provider_subscription_id = obj.get("id") or row.provider_subscription_id
            row.provider_event_created_at = event_created_at or row.provider_event_created_at
            row.current_period_start = _timestamp(obj.get("current_start"))
            row.current_period_end = _timestamp(obj.get("current_end"))
            row.cancel_at_period_end = bool(obj.get("cancel_at_cycle_end"))
            status = obj.get("status") or event_type.removeprefix("subscription.")
            status_map = {
                "activated": "active", "charged": "active", "resumed": "active",
                "pending": "past_due", "halted": "unpaid", "cancelled": "canceled",
                "completed": "completed",
            }
            row.status = status_map.get(status, status)
            row.plan = (_plan_from_subscription(obj)
                        if row.status not in {"canceled", "completed", "expired"}
                        else "trial")
            db.query(Workspace).filter_by(organization_id=organization_id).update(
                {"retention_days": plan_for(row.plan).retention_days},
                synchronize_session=False,
            )

        receipt.status = "processed"
        receipt.processed_at = now()
        receipt.error = None
        db.commit()
    except Exception as exc:
        db.rollback()
        receipt = db.get(BillingWebhookEvent, event_id)
        if receipt:
            receipt.status = "failed"
            receipt.error = f"{type(exc).__name__}: {exc}"[:1000]
            db.commit()
        raise
    return {"received": True}
