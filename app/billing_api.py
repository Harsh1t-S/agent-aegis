"""Razorpay subscription checkout, payment verification, and webhooks."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone

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


class VerifyPaymentIn(BaseModel):
    orderId: str | None = None
    subscriptionId: str | None = None
    paymentId: str
    signature: str
    plan: str


def _credentials() -> tuple[str, str]:
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        raise HTTPException(503, "Billing is not configured yet")
    return key_id, key_secret


def _plan_amounts() -> dict[str, int]:
    return {key: plan.monthly_price_inr * 100 for key, plan in PLANS.items()
            if key in {"starter", "team"}}


def _plan_ids() -> dict[str, str]:
    return {
        "starter": os.getenv("RAZORPAY_STARTER_PLAN_ID", ""),
        "team": os.getenv("RAZORPAY_TEAM_PLAN_ID", ""),
    }


def _billing_mode() -> str:
    plan_ids = _plan_ids()
    return "subscription" if plan_ids["starter"] and plan_ids["team"] else "one_time"


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


def _mark_checkout_pending(
    subscription: Subscription, provider_id: str, status: str,
) -> None:
    subscription.provider = "razorpay"
    subscription.provider_customer_id = None
    subscription.provider_subscription_id = provider_id
    subscription.plan = "trial"
    subscription.status = status
    subscription.current_period_start = None
    subscription.current_period_end = None
    subscription.cancel_at_period_end = False


def _checkout_ready() -> bool:
    return bool(os.getenv("RAZORPAY_KEY_ID") and os.getenv("RAZORPAY_KEY_SECRET"))


@router.get("/billing")
def billing_summary(db: Session = Depends(get_db),
                    context: WorkspaceContext = Depends(current_workspace)):
    subscription = _subscription(db, context.organization_id)
    summary = usage_summary(db, context.workspace_id, context.organization_id)
    plans = _plan_amounts()
    return {
        **summary,
        "provider": "razorpay",
        "billingMode": _billing_mode(),
        "customerConfigured": subscription.status == "active",
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
    amount = _plan_amounts().get(body.plan)
    if body.plan not in {"starter", "team"} or not amount:
        raise HTTPException(422, "That payment plan is not available")
    subscription = _subscription(db, context.organization_id)
    current = datetime.now(timezone.utc).replace(tzinfo=None)
    if (subscription.status == "active"
            and (subscription.current_period_end is None
                 or subscription.current_period_end > current)):
        raise HTTPException(409, "This organization already has an active payment")

    organization = db.get(Organization, context.organization_id)
    if _billing_mode() == "subscription":
        plan_id = _plan_ids()[body.plan]
        if (subscription.provider_subscription_id
                and subscription.provider_subscription_id.startswith("sub_")
                and subscription.status in {"created", "authenticated"}):
            pending = _razorpay_request(
                "GET", f"subscriptions/{subscription.provider_subscription_id}")
            if pending.get("plan_id") == plan_id:
                _mark_checkout_pending(
                    subscription,
                    subscription.provider_subscription_id,
                    pending.get("status", "created"),
                )
                db.commit()
                return {
                    "mode": "subscription",
                    "subscriptionId": subscription.provider_subscription_id,
                    "keyId": _credentials()[0],
                    "name": "Aegis",
                    "description": f"Aegis {body.plan.title()} monthly plan",
                }
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
        subscription_id = response.get("id")
        if not subscription_id:
            raise HTTPException(502, "Razorpay did not return a subscription ID")
        _mark_checkout_pending(
            subscription, subscription_id, response.get("status", "created"))
        audit(db, context, "billing.checkout.created", "organization",
              context.organization_id,
              {"plan": body.plan, "provider": "razorpay", "mode": "subscription"})
        db.commit()
        return {
            "mode": "subscription",
            "subscriptionId": subscription_id,
            "keyId": _credentials()[0],
            "name": "Aegis",
            "description": f"Aegis {body.plan.title()} monthly plan",
        }

    response = _razorpay_request("POST", "orders", data={
        "amount": amount,
        "currency": "INR",
        "receipt": f"aegis_{context.organization_id[:12]}_{int(datetime.now(timezone.utc).timestamp())}",
        "notes": {
            "organization_id": context.organization_id,
            "plan": body.plan,
            "product": "aegis",
        },
    })
    order_id = response.get("id")
    if not order_id:
        raise HTTPException(502, "Razorpay did not return an order ID")
    _mark_checkout_pending(
        subscription, response["id"], response.get("status", "created"))
    audit(db, context, "billing.checkout.created", "organization",
          context.organization_id, {"plan": body.plan, "provider": "razorpay", "mode": "one_time"})
    db.commit()
    return {
        "mode": "order",
        "orderId": order_id,
        "amount": response.get("amount", amount),
        "currency": response.get("currency", "INR"),
        "keyId": _credentials()[0],
        "name": "Aegis",
        "description": f"Aegis {body.plan.title()} plan",
    }


@router.post("/billing/verify")
def verify_payment(
    body: VerifyPaymentIn,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner")
    amount = _plan_amounts().get(body.plan)
    if body.plan not in {"starter", "team"} or not amount:
        raise HTTPException(422, "That payment plan is not available")

    subscription = _subscription(db, context.organization_id)
    provider_id = body.subscriptionId or body.orderId
    if not provider_id or subscription.provider_subscription_id != provider_id:
        raise HTTPException(400, "Payment does not match this organization")

    signed_value = (f"{body.paymentId}|{body.subscriptionId}"
                    if body.subscriptionId
                    else f"{body.orderId}|{body.paymentId}")
    expected = hmac.new(
        _credentials()[1].encode(), signed_value.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.signature):
        raise HTTPException(400, "Invalid Razorpay payment signature")

    payment = _razorpay_request("GET", f"payments/{body.paymentId}")
    if (payment.get("amount") != amount
            or payment.get("currency") != "INR"
            or payment.get("status") not in {"authorized", "captured"}):
        raise HTTPException(400, "Razorpay payment is not authorized")

    if body.subscriptionId:
        remote = _razorpay_request("GET", f"subscriptions/{body.subscriptionId}")
        notes = remote.get("notes") or {}
        if (remote.get("plan_id") != _plan_ids().get(body.plan)
                or notes.get("organization_id") != context.organization_id
                or notes.get("plan") != body.plan):
            raise HTTPException(400, "Razorpay subscription does not match this purchase")
    else:
        order = _razorpay_request("GET", f"orders/{body.orderId}")
        notes = order.get("notes") or {}
        if (notes.get("organization_id") != context.organization_id
                or notes.get("plan") != body.plan
                or order.get("amount") != amount
                or order.get("currency") != "INR"
                or payment.get("order_id") != body.orderId):
            raise HTTPException(400, "Razorpay order details do not match this purchase")

    period_start = datetime.now(timezone.utc).replace(tzinfo=None)
    subscription.provider = "razorpay"
    subscription.provider_subscription_id = provider_id
    subscription.provider_customer_id = (
        remote.get("customer_id") if body.subscriptionId else body.paymentId)
    subscription.plan = body.plan
    subscription.status = "active"
    subscription.current_period_start = (
        _timestamp(remote.get("current_start")) if body.subscriptionId else period_start)
    subscription.current_period_end = (
        _timestamp(remote.get("current_end")) if body.subscriptionId else period_start + timedelta(days=30))
    subscription.current_period_start = subscription.current_period_start or period_start
    subscription.current_period_end = subscription.current_period_end or period_start + timedelta(days=30)
    subscription.cancel_at_period_end = not bool(body.subscriptionId)
    db.query(Workspace).filter_by(organization_id=context.organization_id).update(
        {"retention_days": plan_for(body.plan).retention_days},
        synchronize_session=False,
    )
    audit(db, context, "billing.payment.verified", "organization",
          context.organization_id, {"plan": body.plan, "provider": "razorpay"})
    db.commit()
    return {
        "verified": True,
        "plan": body.plan,
        "status": "active",
        "billingMode": "subscription" if body.subscriptionId else "one_time",
    }


@router.post("/billing/portal")
def create_portal(
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner")
    subscription = _subscription(db, context.organization_id)
    if (not subscription.provider_subscription_id
            or not subscription.provider_subscription_id.startswith("sub_")):
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
