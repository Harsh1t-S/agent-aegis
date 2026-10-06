"""Atomic credit reservation and idempotent settlement."""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .adapters import LLMAgentAdapter, is_self_hosted_model
from .models import Subscription, UsageEvent, UsageReservation, Workspace, now
from .plans import TRIAL_USED, plan_for


def _period(subscription: Subscription | None) -> tuple[datetime, datetime]:
    current = now()
    if (subscription and subscription.current_period_start
            and subscription.current_period_end
            and subscription.current_period_end > current):
        return subscription.current_period_start, subscription.current_period_end
    start = current.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def _consumption(db: Session, workspace_ids, period_start: datetime,
                 period_end: datetime) -> tuple[int, int, float, float]:
    """Settled and reserved credits and model spend across `workspace_ids`."""
    used, estimated_cost = (
        db.query(func.coalesce(func.sum(UsageEvent.units), 0),
                 func.coalesce(func.sum(UsageEvent.estimated_cost_usd), 0.0))
        .filter(UsageEvent.workspace_id.in_(workspace_ids),
                UsageEvent.kind == "settlement",
                UsageEvent.created_at >= period_start,
                UsageEvent.created_at < period_end)
        .one()
    )
    open_units = (UsageReservation.reserved_units
                  - UsageReservation.settled_units
                  - UsageReservation.refunded_units)
    reserved, reserved_cost = (
        db.query(func.coalesce(func.sum(open_units), 0),
                 func.coalesce(func.sum(UsageReservation.reserved_cost_usd * open_units
                                        / UsageReservation.reserved_units), 0.0))
        .filter(UsageReservation.workspace_id.in_(workspace_ids),
                UsageReservation.status == "reserved",
                UsageReservation.expires_at > now())
        .one()
    )
    return int(used or 0), int(reserved or 0), float(estimated_cost or 0.0), float(reserved_cost or 0.0)


def usage_summary(db: Session, workspace_id: str, organization_id: str) -> dict:
    subscription = db.get(Subscription, organization_id)
    current = now()
    paid_plan_active = bool(
        subscription
        and subscription.plan != "trial"
        and subscription.status == "active"
        and (subscription.current_period_end is None
             or subscription.current_period_end > current)
    )
    plan = plan_for(subscription.plan if paid_plan_active else "trial")
    period_start, period_end = _period(subscription)
    # Credits and the plan's spend cap belong to the organization. Counting them
    # per workspace gave a five-workspace Team plan five times what it paid for.
    organization_workspaces = select(Workspace.id).where(
        Workspace.organization_id == organization_id)
    used, reserved, estimated_cost, reserved_cost = _consumption(
        db, organization_workspaces, period_start, period_end)
    trial_spent = bool(subscription and subscription.status == TRIAL_USED)
    included = 0 if trial_spent else plan.monthly_scenario_credits
    plan_cap = 0.0 if trial_spent else float(plan.monthly_model_spend_cap_usd)
    spend_cap = plan_cap
    spend_remaining = max(plan_cap - estimated_cost - reserved_cost, 0.0)

    workspace = db.get(Workspace, workspace_id)
    configured_cap = (workspace.settings or {}).get("monthlySpendCapUsd") if workspace else None
    try:
        configured_cap = float(configured_cap) if configured_cap is not None else None
    except (TypeError, ValueError):
        configured_cap = None
    if configured_cap is not None:
        # A workspace can hold its own share of the spend under a tighter cap.
        spend_cap = min(max(configured_cap, 0.0), plan_cap)
        _, _, workspace_cost, workspace_reserved_cost = _consumption(
            db, [workspace_id], period_start, period_end)
        spend_remaining = min(
            spend_remaining,
            max(spend_cap - workspace_cost - workspace_reserved_cost, 0.0))
    return {
        "plan": plan.payload(),
        "subscriptionStatus": subscription.status if subscription else "trialing",
        "periodStart": period_start.isoformat() + "Z",
        "periodEnd": period_end.isoformat() + "Z",
        "used": used,
        "reserved": reserved,
        "remaining": max(included - used - reserved, 0),
        "included": included,
        "estimatedCostUsd": round(estimated_cost, 6),
        "reservedCostUsd": round(reserved_cost, 6),
        "spendCapUsd": spend_cap,
        "spendRemainingUsd": round(spend_remaining, 6),
    }


def reserve_credits(db: Session, workspace_id: str, organization_id: str,
                    units: int, idempotency_key: str,
                    reserved_cost_usd: float = 0.0) -> UsageReservation:
    existing = db.query(UsageReservation).filter_by(
        idempotency_key=idempotency_key).first()
    if existing:
        return existing
    if units <= 0:
        raise HTTPException(422, "An evaluation must contain at least one scenario")

    subscription = (
        db.query(Subscription)
        .filter_by(organization_id=organization_id)
        .with_for_update()
        .first()
    )
    if subscription and subscription.status == TRIAL_USED:
        raise HTTPException(
            402, "This account has already used its free trial. Choose a plan in "
                 "Billing to keep running evaluations.")
    if subscription and subscription.status in {"past_due", "unpaid", "canceled", "incomplete"}:
        raise HTTPException(402, "Subscription is not active; update billing before running evaluations")
    summary = usage_summary(db, workspace_id, organization_id)
    if units > summary["remaining"]:
        raise HTTPException(
            402,
            f"This evaluation needs {units} scenario credits, but the workspace has "
            f"{summary['remaining']} remaining in the current period.",
        )
    reserved_cost_usd = max(float(reserved_cost_usd), 0.0)
    if reserved_cost_usd > summary["spendRemainingUsd"] + 1e-9:
        raise HTTPException(
            402,
            f"This evaluation reserves ${reserved_cost_usd:.2f} of model spend, but the "
            f"workspace has ${summary['spendRemainingUsd']:.2f} left under its monthly cap.",
        )
    reservation = UsageReservation(
        workspace_id=workspace_id,
        idempotency_key=idempotency_key,
        reserved_units=units,
        reserved_cost_usd=reserved_cost_usd,
        expires_at=now() + timedelta(hours=24),
    )
    db.add(reservation)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.query(UsageReservation).filter_by(
            idempotency_key=idempotency_key).first()
        if existing:
            return existing
        raise
    return reservation


def estimate_reservation_cost(adapter: str, units: int) -> float:
    """Reserve a conservative upper bound before a provider-backed run starts.

    Behavioral runs and connected customer runners do not spend Aegis model
    budget, and neither does a self-hosted Hugging Face Space. For an external
    endpoint with no configured rate, the fallback reserve prevents an
    accidentally unpriced provider from bypassing the workspace cap.
    """
    if adapter != "llm" or units <= 0:
        return 0.0
    explicit = os.getenv("LLM_RESERVED_COST_PER_SCENARIO_USD")
    if explicit is not None:
        try:
            return round(max(float(explicit), 0.0) * units, 6)
        except ValueError as exc:
            raise RuntimeError(
                "LLM_RESERVED_COST_PER_SCENARIO_USD must be a non-negative number"
            ) from exc
    if is_self_hosted_model(os.getenv("LLM_BASE_URL", LLMAgentAdapter.DEFAULT_BASE)):
        return 0.0
    input_rate = max(float(os.getenv("LLM_INPUT_COST_PER_MILLION", "0")), 0.0)
    output_rate = max(float(os.getenv("LLM_OUTPUT_COST_PER_MILLION", "0")), 0.0)
    if input_rate or output_rate:
        steps = max(int(os.getenv("MAX_STEPS", "12")), 1)
        input_tokens = max(int(os.getenv("LLM_MAX_INPUT_TOKENS", "16000")), 1)
        output_tokens = max(int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "2048")), 1)
        per_scenario = steps * (
            input_tokens * input_rate + output_tokens * output_rate
        ) / 1_000_000
    else:
        # Safe default for an external provider whose rates were omitted.
        per_scenario = 0.25
    return round(per_scenario * units, 6)


def attach_evaluation(db: Session, reservation: UsageReservation, evaluation_id: str) -> None:
    reservation.evaluation_id = evaluation_id


def settle_run(db: Session, reservation_id: str | None, run_id: str, workspace_id: str,
               *, input_tokens: int = 0, output_tokens: int = 0,
               estimated_cost_usd: float = 0.0) -> None:
    if not reservation_id:
        return
    key = f"settle:{run_id}"
    if db.query(UsageEvent).filter_by(idempotency_key=key).first():
        return
    reservation = (
        db.query(UsageReservation)
        .filter_by(id=reservation_id, workspace_id=workspace_id)
        .with_for_update()
        .first()
    )
    if not reservation:
        return
    remaining = max(
        reservation.reserved_units
        - reservation.settled_units
        - reservation.refunded_units,
        0,
    )
    units = min(1, remaining)
    event = UsageEvent(
        workspace_id=workspace_id,
        reservation_id=reservation.id,
        test_run_id=run_id,
        kind="settlement",
        units=units,
        input_tokens=max(input_tokens, 0),
        output_tokens=max(output_tokens, 0),
        estimated_cost_usd=max(estimated_cost_usd, 0.0),
        idempotency_key=key,
    )
    try:
        # Flush inside a savepoint so a concurrent worker that already recorded
        # this run loses only the duplicate insert, not its caller's transaction.
        with db.begin_nested():
            db.add(event)
            db.flush()
    except IntegrityError:
        return
    reservation.settled_units += units
    if reservation.settled_units + reservation.refunded_units >= reservation.reserved_units:
        reservation.status = "settled"


def refund_run(db: Session, reservation_id: str | None, run_id: str, workspace_id: str,
               reason: str) -> None:
    if not reservation_id:
        return
    key = f"refund:{run_id}"
    if db.query(UsageEvent).filter_by(idempotency_key=key).first():
        return
    reservation = (
        db.query(UsageReservation)
        .filter_by(id=reservation_id, workspace_id=workspace_id)
        .with_for_update()
        .first()
    )
    if not reservation:
        return
    remaining = max(
        reservation.reserved_units
        - reservation.settled_units
        - reservation.refunded_units,
        0,
    )
    units = min(1, remaining)
    event = UsageEvent(
        workspace_id=workspace_id,
        reservation_id=reservation.id,
        test_run_id=run_id,
        kind="refund",
        units=0,
        metadata_json={"reason": reason},
        idempotency_key=key,
    )
    try:
        with db.begin_nested():
            db.add(event)
            db.flush()
    except IntegrityError:
        return
    reservation.refunded_units += units
    if reservation.settled_units + reservation.refunded_units >= reservation.reserved_units:
        reservation.status = "settled"
