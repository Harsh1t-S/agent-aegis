"""Workspace creation, selection and authorization helpers."""
from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .auth import Principal, principal_from_request
from .database import get_db, set_session_context
from .models import (
    AuditEvent,
    LOCAL_ORGANIZATION_ID,
    LOCAL_USER_ID,
    LOCAL_WORKSPACE_ID,
    Organization,
    OrganizationMembership,
    Subscription,
    UserProfile,
    Workspace,
)


@dataclass(frozen=True)
class WorkspaceContext:
    principal: Principal
    workspace_id: str
    organization_id: str
    workspace_name: str
    role: str

    @property
    def user_id(self) -> str:
        return self.principal.user_id


def _slug(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return (cleaned or fallback)[:90]


def ensure_personal_workspace(db: Session, principal: Principal) -> Workspace:
    set_session_context(db, user_id=principal.user_id, user_email=principal.email)
    membership = (
        db.query(OrganizationMembership)
        .filter_by(user_id=principal.user_id, status="active")
        .order_by(OrganizationMembership.joined_at)
        .first()
    )
    if membership:
        workspace = (
            db.query(Workspace)
            .filter_by(organization_id=membership.organization_id)
            .order_by(Workspace.created_at)
            .first()
        )
        if workspace:
            return workspace

    if principal.user_id == LOCAL_USER_ID:
        workspace = db.get(Workspace, LOCAL_WORKSPACE_ID)
        if workspace:
            return workspace
        organization_id = LOCAL_ORGANIZATION_ID
        organization_name = "Local organization"
        organization_slug = "local"
    else:
        organization_id = None
        stem = (principal.email.split("@", 1)[0] if principal.email else "my")
        organization_name = f"{stem.replace('.', ' ').title()} workspace"
        organization_slug = f"{_slug(stem, 'workspace')}-{principal.user_id[:8]}"

    profile = db.get(UserProfile, principal.user_id)
    if profile is None:
        profile = UserProfile(
            id=principal.user_id,
            email=principal.email,
            display_name=(principal.email.split("@", 1)[0] if principal.email else ""),
        )
        db.add(profile)
    organization = Organization(
        **({"id": organization_id} if organization_id else {}),
        name=organization_name,
        slug=organization_slug,
        created_by=principal.user_id,
        billing_email=principal.email,
    )
    db.add(organization)
    db.flush()
    db.add(OrganizationMembership(
        organization_id=organization.id,
        user_id=principal.user_id,
        role="owner",
    ))
    workspace = Workspace(
        **({"id": LOCAL_WORKSPACE_ID} if principal.user_id == LOCAL_USER_ID else {}),
        organization_id=organization.id,
        name="My workspace",
        slug="default",
        settings={
            "scenariosPerRun": 12,
            "adversarial": True,
            "adapter": "behavioral",
        },
    )
    db.add(workspace)
    db.add(Subscription(
        organization_id=organization.id,
        provider="local" if principal.user_id == LOCAL_USER_ID else "stripe",
        plan="development" if principal.user_id == LOCAL_USER_ID else "trial",
        status="active" if principal.user_id == LOCAL_USER_ID else "trialing",
    ))
    db.commit()
    db.refresh(workspace)
    return workspace


def current_workspace(
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(principal_from_request),
) -> WorkspaceContext:
    set_session_context(db, user_id=principal.user_id, user_email=principal.email)
    selected = principal.workspace_id or request.headers.get("x-workspace-id")

    query = (
        db.query(Workspace, OrganizationMembership)
        .join(OrganizationMembership,
              OrganizationMembership.organization_id == Workspace.organization_id)
        .filter(OrganizationMembership.user_id == principal.user_id,
                OrganizationMembership.status == "active")
    )
    if selected:
        query = query.filter(Workspace.id == selected)
    row = query.order_by(Workspace.created_at).first()
    if row is None and selected:
        raise HTTPException(404, "Workspace not found or you are not a member")
    if row is None:
        ensure_personal_workspace(db, principal)
        row = query.order_by(Workspace.created_at).first()
    if row is None:
        raise HTTPException(403, "No accessible workspace")

    workspace, membership = row
    set_session_context(db, workspace_id=workspace.id)
    return WorkspaceContext(
        principal=principal,
        workspace_id=workspace.id,
        organization_id=workspace.organization_id,
        workspace_name=workspace.name,
        role=membership.role,
    )


def require_role(context: WorkspaceContext, *roles: str) -> None:
    if context.role not in roles:
        raise HTTPException(403, "This action requires workspace administrator access")


def scoped_get(db: Session, model, object_id: str, context: WorkspaceContext,
               detail: str | None = None):
    row = (
        db.query(model)
        .filter(model.id == object_id, model.workspace_id == context.workspace_id)
        .first()
    )
    if row is None:
        raise HTTPException(404, detail or f"{model.__name__} not found")
    return row


def audit(db: Session, context: WorkspaceContext, action: str,
          target_type: str = "", target_id: str = "", detail: dict | None = None) -> None:
    db.add(AuditEvent(
        workspace_id=context.workspace_id,
        actor_user_id=context.user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail or {},
    ))
