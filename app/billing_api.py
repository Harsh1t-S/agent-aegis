"""Stripe Checkout, portal and idempotent subscription webhooks."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
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


def _stripe_key() -> str:
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key:
        raise HTTPException(503, "Billing is not configured yet")
    return key


def _price_ids() -> dict[str, str]:
    return {
        "starter": os.getenv("STRIPE_STARTER_PRICE_ID", ""),
        "team": os.getenv("STRIPE_TEAM_PRICE_ID", ""),
    }


def _stripe_post(path: str, data: list[tuple[str, str]] | dict,
                 idempotency_key: str | None = None) -> dict:
    headers = {"Authorization": f"Bearer {_stripe_key()}"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    try:
        response = httpx.post(
            f"https://api.stripe.com/v1/{path.lstrip('/')}",
            data=data,
            headers=headers,
            timeout=15,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Billing provider is temporarily unavailable") from exc
    if response.status_code >= 400:
        try:
            message = response.json()["error"]["message"]
        except Exception:
            message = "Billing provider rejected the request"
        raise HTTPException(502, message)
    return response.json()


def _subscription(db: Session, organization_id: str) -> Subscription:
    row = db.get(Subscription, organization_id)
    if row is None:
        row = Subscription(organization_id=organization_id)
        db.add(row)
        db.flush()
    return row


@router.get("/billing")
def billing_summary(db: Session = Depends(get_db),
                    context: WorkspaceContext = Depends(current_workspace)):
    subscription = _subscription(db, context.organization_id)
    summary = usage_summary(db, context.workspace_id, context.organization_id)
    prices = _price_ids()
    return {
        **summary,
        "provider": subscription.provider,
        "customerConfigured": bool(subscription.provider_customer_id),
        "subscriptionId": subscription.provider_subscription_id,
        "cancelAtPeriodEnd": subscription.cancel_at_period_end,
        "checkoutAvailable": bool(os.getenv("STRIPE_SECRET_KEY")
                                  and prices["starter"] and prices["team"]),
        "plans": [
            {**plan_for(key).payload(), "available": bool(prices.get(key))}
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
    price_id = _price_ids().get(body.plan)
    if body.plan not in {"starter", "team"} or not price_id:
        raise HTTPException(422, "That subscription plan is not available")
    app_url = os.getenv("APP_URL", "").rstrip("/")
    if not app_url:
        raise HTTPException(503, "APP_URL is not configured")

    subscription = _subscription(db, context.organization_id)
    organization = db.get(Organization, context.organization_id)
    if (subscription.provider_subscription_id
            and subscription.status not in {"canceled", "incomplete_expired"}):
        raise HTTPException(
            409,
            "This organization already has a subscription; change plans in the billing portal",
        )
    if not subscription.provider_customer_id:
        customer = _stripe_post(
            "customers",
            [
                ("email", organization.billing_email or context.principal.email),
                ("name", organization.name),
                ("metadata[organization_id]", organization.id),
            ],
            idempotency_key=f"aegis-customer-{organization.id}",
        )
        subscription.provider_customer_id = customer["id"]
        db.commit()

    session = _stripe_post(
        "checkout/sessions",
        [
            ("mode", "subscription"),
            ("customer", subscription.provider_customer_id),
            ("line_items[0][price]", price_id),
            ("line_items[0][quantity]", "1"),
            ("success_url", f"{app_url}/app/settings?billing=success"),
            ("cancel_url", f"{app_url}/pricing?billing=cancelled"),
            ("client_reference_id", context.organization_id),
            ("metadata[organization_id]", context.organization_id),
            ("metadata[plan]", body.plan),
            ("subscription_data[metadata][organization_id]", context.organization_id),
            ("subscription_data[metadata][plan]", body.plan),
            ("allow_promotion_codes", "true"),
        ],
        idempotency_key=f"aegis-checkout-{context.organization_id}-{body.plan}-{int(time.time()) // 300}",
    )
    audit(db, context, "billing.checkout.created", "organization",
          context.organization_id, {"plan": body.plan})
    db.commit()
    return {"url": session["url"]}


@router.post("/billing/portal")
def create_portal(
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner")
    subscription = _subscription(db, context.organization_id)
    if not subscription.provider_customer_id:
        raise HTTPException(409, "Start a subscription before opening the billing portal")
    app_url = os.getenv("APP_URL", "").rstrip("/")
    if not app_url:
        raise HTTPException(503, "APP_URL is not configured")
    session = _stripe_post(
        "billing_portal/sessions",
        {"customer": subscription.provider_customer_id,
         "return_url": f"{app_url}/app/settings"},
    )
    return {"url": session["url"]}


def _verify_signature(payload: bytes, signature: str) -> None:
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(503, "Stripe webhook secret is not configured")
    fields = {}
    for part in signature.split(","):
        key, _, value = part.partition("=")
        fields.setdefault(key, []).append(value)
    try:
        timestamp = int(fields["t"][0])
    except (KeyError, ValueError, IndexError) as exc:
        raise HTTPException(400, "Malformed Stripe signature") from exc
    if abs(int(time.time()) - timestamp) > 300:
        raise HTTPException(400, "Stripe signature timestamp is outside the allowed window")
    signed = f"{timestamp}.".encode() + payload
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, candidate)
               for candidate in fields.get("v1", [])):
        raise HTTPException(400, "Invalid Stripe signature")


def _timestamp(value) -> datetime | None:
    return (datetime.fromtimestamp(value, timezone.utc).replace(tzinfo=None)
            if value else None)


def _plan_from_subscription(obj: dict) -> str:
    metadata = obj.get("metadata") or {}
    if metadata.get("plan") in PLANS:
        return metadata["plan"]
    price_id = (((obj.get("items") or {}).get("data") or [{}])[0]
                .get("price", {}).get("id"))
    for plan, configured in _price_ids().items():
        if configured and configured == price_id:
            return plan
    return "trial"


def _organization_for_event(db: Session, obj: dict) -> str | None:
    metadata = obj.get("metadata") or {}
    if metadata.get("organization_id"):
        return metadata["organization_id"]
    customer = obj.get("customer")
    if customer:
        row = db.query(Subscription).filter_by(
            provider_customer_id=customer).first()
        return row.organization_id if row else None
    return None


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    set_session_context(db, worker=True)
    payload = await request.body()
    _verify_signature(payload, request.headers.get("stripe-signature", ""))
    try:
        event = json.loads(payload)
        event_id = event["id"]
        event_type = event["type"]
        obj = event["data"]["object"]
    except (KeyError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(400, "Malformed Stripe event") from exc

    receipt = db.get(BillingWebhookEvent, event_id)
    if receipt and receipt.status == "processed":
        return {"received": True, "duplicate": True}
    if receipt is None:
        receipt = BillingWebhookEvent(
            id=event_id,
            event_type=event_type,
            payload=event,
        )
        db.add(receipt)
        db.commit()  # durable receipt before side effects

    try:
        organization_id = _organization_for_event(db, obj)
        provider_created_at = _timestamp(event.get("created"))
        state_types = {
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
            "invoice.payment_failed",
            "invoice.paid",
        }
        state_row = (_subscription(db, organization_id)
                     if organization_id and event_type in state_types else None)
        if (state_row and provider_created_at and state_row.provider_event_created_at
                and provider_created_at < state_row.provider_event_created_at):
            # Stripe does not guarantee delivery order. Record the receipt while
            # preserving the newer entitlement/payment state already applied.
            receipt.status = "processed"
            receipt.processed_at = now()
            receipt.error = None
            db.commit()
            return {"received": True, "ignored": "stale_event"}
        if state_row is not None and provider_created_at:
            state_row.provider_event_created_at = provider_created_at

        if event_type == "checkout.session.completed":
            organization_id = (obj.get("metadata") or {}).get(
                "organization_id") or obj.get("client_reference_id")
            if organization_id:
                row = _subscription(db, organization_id)
                row.provider_customer_id = obj.get("customer") or row.provider_customer_id
                row.provider_subscription_id = (
                    obj.get("subscription") or row.provider_subscription_id)
        elif event_type in {
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
        } and organization_id:
            row = state_row
            row.provider_customer_id = obj.get("customer") or row.provider_customer_id
            row.provider_subscription_id = obj.get("id")
            row.plan = (_plan_from_subscription(obj)
                        if event_type != "customer.subscription.deleted" else "trial")
            row.status = ("canceled" if event_type == "customer.subscription.deleted"
                          else obj.get("status", row.status))
            row.current_period_start = _timestamp(obj.get("current_period_start"))
            row.current_period_end = _timestamp(obj.get("current_period_end"))
            row.cancel_at_period_end = bool(obj.get("cancel_at_period_end"))
            db.query(Workspace).filter_by(organization_id=organization_id).update(
                {"retention_days": plan_for(row.plan).retention_days},
                synchronize_session=False,
            )
        elif event_type == "invoice.payment_failed" and organization_id:
            state_row.status = "past_due"
        elif event_type == "invoice.paid" and organization_id:
            row = state_row
            if row.status != "canceled":
                row.status = "active"

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
