"""Account, workspace and collaboration endpoints."""
from __future__ import annotations

import hashlib
import os
import secrets
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from .auth import Principal, auth_disabled, principal_from_request, token_hash
from .database import get_db, set_session_context
from .models import (
    AuditEvent,
    FindingReview,
    Organization,
    OrganizationMembership,
    Subscription,
    UserProfile,
    Workspace,
    WorkspaceApiKey,
    WorkspaceInvitation,
    now,
)
from .plans import plan_for
from .tenancy import (
    WorkspaceContext,
    audit,
    current_workspace,
    ensure_personal_workspace,
    require_role,
)
from .usage import usage_summary

router = APIRouter(prefix="/api", tags=["saas"])


class WorkspaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WorkspaceDeleteIn(BaseModel):
    confirmation: str = Field(min_length=1, max_length=200)


class NotificationSettings(BaseModel):
    emailEnabled: bool = False
    email: str = Field(default="", max_length=320)

    @model_validator(mode="after")
    def validate_destination(self):
        if self.emailEnabled and ("@" not in self.email or self.email.startswith("@")):
            raise ValueError("Enter a valid notification email before enabling delivery")
        return self


class SettingsPatch(BaseModel):
    scenariosPerRun: int | None = Field(default=None, ge=4, le=40)
    adversarial: bool | None = None
    adapter: Literal["behavioral", "llm", "http"] | None = None
    monthlySpendCapUsd: float | None = Field(default=None, ge=0, le=1_000_000)
    notifications: NotificationSettings | None = None


class InvitationIn(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: Literal["admin", "member", "viewer"] = "member"


class MemberRoleIn(BaseModel):
    role: Literal["admin", "member", "viewer"]


class ApiKeyIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    scopes: list[Literal["read", "evaluate", "admin"]] = Field(
        default_factory=lambda: ["read", "evaluate"], min_length=1, max_length=3)
    expiresInDays: int | None = Field(default=None, ge=1, le=365)


class FindingReviewIn(BaseModel):
    decision: Literal[
        "confirmed_issue", "false_positive", "accepted_risk",
        "confirmed_correct", "missed_issue",
    ]
    note: str = Field(default="", max_length=4000)


def _workspace_payload(workspace: Workspace, role: str) -> dict:
    return {
        "id": workspace.id,
        "organizationId": workspace.organization_id,
        "name": workspace.name,
        "slug": workspace.slug,
        "role": role,
        "settings": workspace.settings or {},
        "retentionDays": workspace.retention_days,
        "createdAt": workspace.created_at.isoformat() + "Z",
    }


def _all_workspaces(db: Session, principal: Principal) -> list[tuple[Workspace, str]]:
    rows = (
        db.query(Workspace, OrganizationMembership.role)
        .join(OrganizationMembership,
              OrganizationMembership.organization_id == Workspace.organization_id)
        .filter(OrganizationMembership.user_id == principal.user_id,
                OrganizationMembership.status == "active")
        .order_by(Workspace.created_at)
        .all()
    )
    return [(workspace, role) for workspace, role in rows]


@router.get("/public/config")
def public_config():
    prices_ready = bool(
        os.getenv("RAZORPAY_KEY_ID")
        and os.getenv("RAZORPAY_KEY_SECRET")
    )
    return {
        "authRequired": not auth_disabled(),
        "billingProvider": "razorpay" if os.getenv("RAZORPAY_KEY_ID") else None,
        "billingMode": (
            "subscription"
            if os.getenv("RAZORPAY_STARTER_PLAN_ID")
            and os.getenv("RAZORPAY_TEAM_PLAN_ID")
            else "one_time"
        ),
        "checkoutAvailable": prices_ready,
        "plans": [
            plan_for("starter").payload(),
            plan_for("team").payload(),
        ],
    }


@router.post("/bootstrap")
def bootstrap(
    db: Session = Depends(get_db),
    principal: Principal = Depends(principal_from_request),
):
    set_session_context(db, user_id=principal.user_id, user_email=principal.email)
    selected = ensure_personal_workspace(db, principal)
    profile = db.get(UserProfile, principal.user_id)
    workspaces = _all_workspaces(db, principal)
    membership_role = next(
        (role for workspace, role in workspaces if workspace.id == selected.id), "owner")
    return {
        "user": {
            "id": principal.user_id,
            "email": principal.email or (profile.email if profile else ""),
            "displayName": profile.display_name if profile else "",
        },
        "currentWorkspaceId": selected.id,
        "workspaces": [_workspace_payload(workspace, role)
                       for workspace, role in workspaces],
        "usage": usage_summary(
            db, selected.id, selected.organization_id),
        "role": membership_role,
    }


@router.get("/workspaces")
def list_workspaces(
    db: Session = Depends(get_db),
    principal: Principal = Depends(principal_from_request),
):
    set_session_context(db, user_id=principal.user_id, user_email=principal.email)
    return [_workspace_payload(workspace, role)
            for workspace, role in _all_workspaces(db, principal)]


@router.post("/workspaces", status_code=201)
def create_workspace(
    body: WorkspaceIn,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    subscription = usage_summary(db, context.workspace_id, context.organization_id)
    entitlement = plan_for(subscription["plan"]["key"])
    count = db.query(Workspace).filter_by(
        organization_id=context.organization_id).count()
    if count >= entitlement.workspaces:
        raise HTTPException(
            402,
            f"The {entitlement.name} plan includes {entitlement.workspaces} workspace(s).",
        )
    stem = "".join(ch.lower() if ch.isalnum() else "-" for ch in body.name)
    stem = "-".join(part for part in stem.split("-") if part)[:80] or "workspace"
    slug, suffix = stem, 1
    while db.query(Workspace).filter_by(
            organization_id=context.organization_id, slug=slug).first():
        suffix += 1
        slug = f"{stem}-{suffix}"
    workspace = Workspace(
        organization_id=context.organization_id,
        name=body.name.strip(),
        slug=slug,
        settings={
            "scenariosPerRun": 12,
            "adversarial": True,
            "adapter": "behavioral",
        },
        retention_days=entitlement.retention_days,
    )
    db.add(workspace)
    db.flush()
    audit(db, context, "workspace.created", "workspace", workspace.id,
          {"name": workspace.name})
    db.commit()
    db.refresh(workspace)
    return _workspace_payload(workspace, context.role)


@router.get("/workspace")
def read_workspace(context: WorkspaceContext = Depends(current_workspace),
                   db: Session = Depends(get_db)):
    from .notifications import notifications_available

    workspace = db.get(Workspace, context.workspace_id)
    return {
        **_workspace_payload(workspace, context.role),
        "usage": usage_summary(db, context.workspace_id, context.organization_id),
        "notificationsAvailable": notifications_available(),
    }


@router.patch("/workspace/settings")
def update_workspace_settings(
    body: SettingsPatch,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    workspace = db.get(Workspace, context.workspace_id)
    patch = body.model_dump(exclude_none=True)
    if "monthlySpendCapUsd" in patch:
        plan = plan_for(usage_summary(
            db, context.workspace_id, context.organization_id)["plan"]["key"])
        if patch["monthlySpendCapUsd"] > plan.monthly_model_spend_cap_usd:
            raise HTTPException(
                422,
                f"The {plan.name} plan permits a model spend cap up to "
                f"${plan.monthly_model_spend_cap_usd:.2f} per workspace.",
            )
    workspace.settings = {**(workspace.settings or {}), **patch}
    audit(db, context, "workspace.settings.updated", "workspace", workspace.id,
          {"fields": sorted(patch)})
    db.commit()
    return workspace.settings


@router.delete("/workspace", status_code=204)
def delete_workspace(
    body: WorkspaceDeleteIn,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    """Delete a workspace and, when it is the last one, its organization."""
    require_role(context, "owner")
    workspace = db.get(Workspace, context.workspace_id)
    if body.confirmation.strip() != workspace.name:
        raise HTTPException(422, "Type the workspace name exactly to confirm deletion")
    siblings = db.query(Workspace).filter(
        Workspace.organization_id == context.organization_id,
        Workspace.id != context.workspace_id,
    ).count()
    if not siblings:
        subscription = db.get(Subscription, context.organization_id)
        if (subscription and subscription.provider_subscription_id
                and subscription.status not in {"canceled", "incomplete_expired"}):
            raise HTTPException(
                409,
                "Cancel the active subscription in Billing before deleting the final workspace",
            )
        organization = db.get(Organization, context.organization_id)
        db.delete(organization)
    else:
        db.delete(workspace)
    db.commit()
    from fastapi import Response
    return Response(status_code=204)


@router.get("/members")
def list_members(db: Session = Depends(get_db),
                 context: WorkspaceContext = Depends(current_workspace)):
    rows = (
        db.query(OrganizationMembership, UserProfile)
        .outerjoin(UserProfile, UserProfile.id == OrganizationMembership.user_id)
        .filter(OrganizationMembership.organization_id == context.organization_id,
                OrganizationMembership.status == "active")
        .order_by(OrganizationMembership.joined_at)
        .all()
    )
    return [{
        "id": membership.user_id,
        "email": profile.email if profile else "",
        "displayName": profile.display_name if profile else "",
        "role": membership.role,
        "joinedAt": membership.joined_at.isoformat() + "Z",
    } for membership, profile in rows]


def _manageable_member(db: Session, context: WorkspaceContext,
                       user_id: str) -> OrganizationMembership:
    target = db.query(OrganizationMembership).filter_by(
        organization_id=context.organization_id,
        user_id=user_id,
        status="active",
    ).first()
    if not target:
        raise HTTPException(404, "Member not found")
    if target.role == "owner":
        raise HTTPException(409, "Workspace owners cannot be changed from this screen")
    if context.role == "admin" and target.role == "admin":
        raise HTTPException(403, "Only an owner can manage another administrator")
    return target


def _expire_invitations(db: Session, organization_id: str) -> None:
    db.query(WorkspaceInvitation).filter(
        WorkspaceInvitation.organization_id == organization_id,
        WorkspaceInvitation.status == "pending",
        WorkspaceInvitation.expires_at <= now(),
    ).update({"status": "revoked"}, synchronize_session=False)


@router.patch("/members/{user_id}")
def update_member_role(
    user_id: str,
    body: MemberRoleIn,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    target = _manageable_member(db, context, user_id)
    previous = target.role
    target.role = body.role
    audit(db, context, "member.role.updated", "user", user_id,
          {"from": previous, "to": body.role})
    db.commit()
    return {"id": user_id, "role": target.role}


@router.delete("/members/{user_id}", status_code=204)
def remove_member(
    user_id: str,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    if user_id == context.user_id:
        raise HTTPException(409, "You cannot remove your own account here")
    target = _manageable_member(db, context, user_id)
    target.status = "suspended"
    audit(db, context, "member.removed", "user", user_id,
          {"previousRole": target.role})
    db.commit()
    from fastapi import Response
    return Response(status_code=204)


@router.post("/invitations", status_code=201)
def create_invitation(
    body: InvitationIn,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    _expire_invitations(db, context.organization_id)
    plan = plan_for(usage_summary(
        db, context.workspace_id, context.organization_id)["plan"]["key"])
    active = db.query(OrganizationMembership).filter_by(
        organization_id=context.organization_id, status="active").count()
    pending = db.query(WorkspaceInvitation).filter_by(
        organization_id=context.organization_id, status="pending").count()
    if active + pending >= plan.members:
        raise HTTPException(402, f"The {plan.name} plan includes {plan.members} team member(s).")

    email = body.email.strip().lower()
    existing = (
        db.query(WorkspaceInvitation)
        .filter_by(organization_id=context.organization_id, email=email, status="pending")
        .first()
    )
    if existing:
        existing.status = "superseded"
    token = secrets.token_urlsafe(32)
    invitation = WorkspaceInvitation(
        organization_id=context.organization_id,
        email=email,
        role=body.role,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        invited_by=context.user_id,
        expires_at=now() + timedelta(days=7),
    )
    db.add(invitation)
    audit(db, context, "member.invited", "invitation", invitation.id,
          {"email": email, "role": body.role})
    db.commit()
    app_url = os.getenv("APP_URL", "").rstrip("/")
    return {
        "id": invitation.id,
        "email": email,
        "role": body.role,
        "expiresAt": invitation.expires_at.isoformat() + "Z",
        # Until an email provider is configured, the owner can copy this one-time
        # link. The raw token is never persisted.
        "inviteUrl": f"{app_url}/accept-invite?token={token}" if app_url else
                     f"/accept-invite?token={token}",
        "delivery": "manual",
    }


@router.get("/invitations")
def list_invitations(
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    _expire_invitations(db, context.organization_id)
    db.flush()
    rows = db.query(WorkspaceInvitation).filter_by(
        organization_id=context.organization_id,
        status="pending",
    ).order_by(WorkspaceInvitation.created_at.desc()).limit(100).all()
    return [{
        "id": row.id,
        "email": row.email,
        "role": row.role,
        "expiresAt": row.expires_at.isoformat() + "Z",
        "createdAt": row.created_at.isoformat() + "Z",
    } for row in rows]


@router.delete("/invitations/{invitation_id}", status_code=204)
def revoke_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    invitation = db.query(WorkspaceInvitation).filter_by(
        id=invitation_id,
        organization_id=context.organization_id,
        status="pending",
    ).first()
    if not invitation:
        raise HTTPException(404, "Pending invitation not found")
    invitation.status = "revoked"
    audit(db, context, "member.invitation.revoked", "invitation", invitation.id,
          {"email": invitation.email})
    db.commit()
    from fastapi import Response
    return Response(status_code=204)


@router.post("/invitations/{token}/accept")
def accept_invitation(
    token: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(principal_from_request),
):
    # Acceptance is authorised by the signed-in email plus a one-time random
    # token. It intentionally runs outside a workspace the user has not joined.
    set_session_context(db, user_id=principal.user_id,
                        user_email=principal.email, worker=True)
    if principal.auth_type == "api_key" or not principal.email:
        raise HTTPException(403, "Sign in with the invited user account")
    digest = hashlib.sha256(token.encode()).hexdigest()
    invitation = db.query(WorkspaceInvitation).filter_by(
        token_hash=digest, status="pending").first()
    if not invitation or invitation.expires_at <= now():
        raise HTTPException(404, "Invitation is invalid or expired")
    if invitation.email != principal.email.lower():
        raise HTTPException(403, "Sign in with the email address that was invited")
    membership = (
        db.query(OrganizationMembership)
        .filter_by(organization_id=invitation.organization_id,
                   user_id=principal.user_id)
        .first()
    )
    if membership:
        membership.status = "active"
        membership.role = invitation.role
    else:
        db.add(OrganizationMembership(
            organization_id=invitation.organization_id,
            user_id=principal.user_id,
            role=invitation.role,
        ))
    profile = db.get(UserProfile, principal.user_id)
    if not profile:
        db.add(UserProfile(id=principal.user_id, email=principal.email,
                           display_name=principal.email.split("@", 1)[0]))
    invitation.status = "accepted"
    invitation.accepted_at = now()
    db.commit()
    workspace = db.query(Workspace).filter_by(
        organization_id=invitation.organization_id).order_by(
        Workspace.created_at).first()
    return {"accepted": True, "workspaceId": workspace.id if workspace else None}


@router.get("/api-keys")
def list_api_keys(db: Session = Depends(get_db),
                  context: WorkspaceContext = Depends(current_workspace)):
    require_role(context, "owner", "admin")
    rows = db.query(WorkspaceApiKey).filter_by(
        workspace_id=context.workspace_id).order_by(
        WorkspaceApiKey.created_at.desc()).all()
    return [{
        "id": row.id,
        "name": row.name,
        "prefix": row.prefix,
        "scopes": row.scopes,
        "createdAt": row.created_at.isoformat() + "Z",
        "lastUsedAt": row.last_used_at.isoformat() + "Z" if row.last_used_at else None,
        "expiresAt": row.expires_at.isoformat() + "Z" if row.expires_at else None,
        "revoked": row.revoked_at is not None,
    } for row in rows]


@router.post("/api-keys", status_code=201)
def create_api_key(
    body: ApiKeyIn,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    raw = f"aegis_{secrets.token_urlsafe(32)}"
    record = WorkspaceApiKey(
        workspace_id=context.workspace_id,
        name=body.name.strip(),
        prefix=raw[:16],
        secret_hash=token_hash(raw),
        created_by=context.user_id,
        scopes=sorted(set(body.scopes)),
        expires_at=(now() + timedelta(days=body.expiresInDays)
                    if body.expiresInDays else None),
    )
    db.add(record)
    audit(db, context, "api_key.created", "api_key", record.id,
          {"name": record.name, "scopes": record.scopes})
    db.commit()
    return {"id": record.id, "name": record.name, "key": raw,
            "prefix": record.prefix, "scopes": record.scopes}


@router.delete("/api-keys/{key_id}", status_code=204)
def revoke_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    record = db.query(WorkspaceApiKey).filter_by(
        id=key_id, workspace_id=context.workspace_id).first()
    if not record:
        raise HTTPException(404, "API key not found")
    record.revoked_at = now()
    audit(db, context, "api_key.revoked", "api_key", record.id,
          {"name": record.name})
    db.commit()
    from fastapi import Response
    return Response(status_code=204)


@router.get("/audit")
def audit_log(
    before: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    require_role(context, "owner", "admin")
    limit = min(max(limit, 1), 100)
    query = db.query(AuditEvent).filter_by(workspace_id=context.workspace_id)
    if before:
        cursor = db.query(AuditEvent).filter_by(
            id=before, workspace_id=context.workspace_id).first()
        if cursor:
            query = query.filter(
                (AuditEvent.created_at < cursor.created_at)
                | ((AuditEvent.created_at == cursor.created_at)
                   & (AuditEvent.id < cursor.id)))
    rows = query.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(
        limit + 1).all()
    page, has_more = rows[:limit], len(rows) > limit
    return {
        "items": [{
            "id": row.id,
            "action": row.action,
            "actorUserId": row.actor_user_id,
            "targetType": row.target_type,
            "targetId": row.target_id,
            "detail": row.detail,
            "createdAt": row.created_at.isoformat() + "Z",
        } for row in page],
        "nextCursor": page[-1].id if has_more and page else None,
    }


@router.put("/test-runs/{run_id}/review")
def review_finding(
    run_id: str,
    body: FindingReviewIn,
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    from .models import TestRun
    if context.role == "viewer":
        raise HTTPException(403, "Viewers cannot review findings")
    run = db.query(TestRun).filter_by(
        id=run_id, workspace_id=context.workspace_id).first()
    if not run:
        raise HTTPException(404, "Test run not found")
    review = db.query(FindingReview).filter_by(
        test_run_id=run_id, reviewer_user_id=context.user_id).first()
    if review:
        review.decision = body.decision
        review.note = body.note
    else:
        review = FindingReview(
            workspace_id=context.workspace_id,
            test_run_id=run_id,
            reviewer_user_id=context.user_id,
            decision=body.decision,
            note=body.note,
        )
        db.add(review)
    audit(db, context, "finding.reviewed", "test_run", run_id,
          {"decision": body.decision})
    db.commit()
    db.refresh(review)
    return {"testRunId": run_id, "decision": body.decision, "note": body.note,
            "updatedAt": review.updated_at.isoformat() + "Z"}


@router.get("/benchmark/reviews")
def export_reviewed_benchmark(
    db: Session = Depends(get_db),
    context: WorkspaceContext = Depends(current_workspace),
):
    """Export labels only; customer prompts, traces and responses stay private."""
    require_role(context, "owner", "admin")
    from .models import FailureAnnotation, Scenario, TestRun

    reviews = db.query(FindingReview).order_by(FindingReview.created_at).all()
    records = []
    positive_labels = {"confirmed_issue", "accepted_risk", "missed_issue"}
    for review in reviews:
        run = db.get(TestRun, review.test_run_id)
        if not run or run.status != "complete":
            continue
        scenario = db.get(Scenario, run.scenario_id)
        findings = db.query(FailureAnnotation).filter_by(
            test_run_id=run.id).all()
        records.append({
            "testRunId": run.id,
            "evaluationId": run.agent_version_id,
            "scenarioFingerprint": ((scenario.fingerprint if scenario else "")
                                    or run.scenario_id),
            "category": scenario.category if scenario else "unknown",
            "predictedIssue": run.outcome in {"fail", "warning"},
            "humanIssue": review.decision in positive_labels,
            "reviewDecision": review.decision,
            "findingTypes": sorted({finding.failure_type for finding in findings}),
            "highestSeverity": next((level for level in (
                "critical", "high", "medium", "low")
                if any(finding.severity == level for finding in findings)), None),
            "createdAt": review.created_at.isoformat() + "Z",
            "updatedAt": review.updated_at.isoformat() + "Z",
        })
    return {
        "schemaVersion": "aegis-reviewed-benchmark-v1",
        "exportedAt": now().isoformat() + "Z",
        "workspaceId": context.workspace_id,
        "records": records,
    }
