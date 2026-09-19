import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


# Stable identities keep local development and the test suite useful without a
# hosted identity provider. Production requests never fall back to these values.
LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001"
LOCAL_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000002"
LOCAL_WORKSPACE_ID = "00000000-0000-0000-0000-000000000003"
DEMO_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000004"
DEMO_WORKSPACE_ID = "00000000-0000-0000-0000-000000000005"


def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    # Naive UTC keeps parity with existing rows; utcnow() is deprecated on 3.12+.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UserProfile(Base):
    __tablename__ = "user_profiles"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), default="")
    display_name: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    created_by: Mapped[str] = mapped_column(String, index=True)
    billing_email: Mapped[str] = mapped_column(String(320), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (UniqueConstraint(
        "organization_id", "user_id", name="uq_membership_organization_user"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    role: Mapped[str] = mapped_column(String(20), default="member")
    status: Mapped[str] = mapped_column(String(20), default="active")
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (UniqueConstraint(
        "organization_id", "slug", name="uq_workspace_organization_slug"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120))
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    retention_days: Mapped[int] = mapped_column(Integer, default=90)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class WorkspaceInvitation(Base):
    __tablename__ = "workspace_invitations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    role: Mapped[str] = mapped_column(String(20), default="member")
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    invited_by: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class WorkspaceApiKey(Base):
    __tablename__ = "workspace_api_keys"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    prefix: Mapped[str] = mapped_column(String(24), index=True)
    secret_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_by: Mapped[str] = mapped_column(String, index=True)
    scopes: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Subscription(Base):
    __tablename__ = "subscriptions"
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    provider: Mapped[str] = mapped_column(String(30), default="razorpay")
    provider_customer_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True, unique=True)
    provider_subscription_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True, unique=True)
    plan: Mapped[str] = mapped_column(String(30), default="trial")
    status: Mapped[str] = mapped_column(String(30), default="trialing")
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    provider_event_created_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class BillingWebhookEvent(Base):
    __tablename__ = "billing_webhook_events"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    provider: Mapped[str] = mapped_column(String(30), default="razorpay")
    event_type: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="received")
    received_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class UsageReservation(Base):
    __tablename__ = "usage_reservations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    evaluation_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)
    reserved_units: Mapped[int] = mapped_column(Integer)
    reserved_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    settled_units: Mapped[int] = mapped_column(Integer, default=0)
    refunded_units: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="reserved")
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class UsageEvent(Base):
    __tablename__ = "usage_events"
    __table_args__ = (UniqueConstraint(
        "idempotency_key", name="uq_usage_event_idempotency"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    reservation_id: Mapped[str | None] = mapped_column(
        ForeignKey("usage_reservations.id", ondelete="SET NULL"), nullable=True, index=True)
    test_run_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(30))
    units: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    idempotency_key: Mapped[str] = mapped_column(String(180))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    target_type: Mapped[str] = mapped_column(String(80), default="")
    target_id: Mapped[str] = mapped_column(String, default="")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"
    __table_args__ = (UniqueConstraint(
        "evaluation_id", "channel", "destination",
        name="uq_notification_evaluation_channel_destination"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    evaluation_id: Mapped[str] = mapped_column(String, index=True)
    channel: Mapped[str] = mapped_column(String(30), default="email")
    destination: Mapped[str] = mapped_column(String(320))
    status: Mapped[str] = mapped_column(String(20), default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    provider_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ReportShare(Base):
    __tablename__ = "report_shares"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    evaluation_id: Mapped[str] = mapped_column(
        ForeignKey("agent_versions.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_by: Mapped[str] = mapped_column(String, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Agent(Base):
    __tablename__ = "agents"
    __table_args__ = (UniqueConstraint(
        "workspace_id", "name", name="uq_agents_workspace_name"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        default=LOCAL_WORKSPACE_ID, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    endpoint_config: Mapped[dict] = mapped_column(JSON, default=dict)
    # Introspection inputs and the cached profile derived from them.
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    tool_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    profile: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AgentVersion(Base):
    __tablename__ = "agent_versions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        default=LOCAL_WORKSPACE_ID, index=True)
    agent_id: Mapped[str] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), index=True)
    version_label: Mapped[str] = mapped_column(String(100))
    config_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    dataset_hash: Mapped[str] = mapped_column(String(64), default="", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class MockEnvironment(Base):
    __tablename__ = "mock_environments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        default=LOCAL_WORKSPACE_ID, index=True)
    name: Mapped[str] = mapped_column(String(200))
    tool_definitions: Mapped[dict] = mapped_column(JSON, default=dict)
    initial_state: Mapped[dict] = mapped_column(JSON, default=dict)
    injected_content: Mapped[dict] = mapped_column(JSON, default=dict)


class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        default=LOCAL_WORKSPACE_ID, index=True)
    name: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(50), default="realistic")
    subtype: Mapped[str] = mapped_column(String(100), default="general")
    initial_prompt: Mapped[str] = mapped_column(Text)
    expected_behavior: Mapped[dict] = mapped_column(JSON, default=dict)
    mock_environment_id: Mapped[str] = mapped_column(
        ForeignKey("mock_environments.id", ondelete="CASCADE"), index=True)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    generator_version: Mapped[str] = mapped_column(String(50), default="manual")
    run_kind: Mapped[str] = mapped_column(String(20), default="suite", index=True)
    injected_content: Mapped[dict] = mapped_column(JSON, default=dict)
    # The complete immutable test contract: input, oracle, state, tool behaviour
    # and injected payload. A change to any of those is a different test.
    fingerprint: Mapped[str] = mapped_column(String(80), default="", index=True)


class TestRun(Base):
    __tablename__ = "test_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        default=LOCAL_WORKSPACE_ID, index=True)
    agent_version_id: Mapped[str] = mapped_column(
        ForeignKey("agent_versions.id", ondelete="CASCADE"), index=True)
    scenario_id: Mapped[str] = mapped_column(
        ForeignKey("scenarios.id", ondelete="CASCADE"), index=True)
    replayed_from_run_id: Mapped[str | None] = mapped_column(
        ForeignKey("test_runs.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    seed: Mapped[int] = mapped_column(Integer, default=0)
    outcome: Mapped[str | None] = mapped_column(String(10), nullable=True)
    reliability_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    final_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)


class EvaluationJob(Base):
    __tablename__ = "evaluation_jobs"
    __table_args__ = (UniqueConstraint(
        "test_run_id", name="uq_evaluation_job_run"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    test_run_id: Mapped[str] = mapped_column(
        ForeignKey("test_runs.id", ondelete="CASCADE"), index=True)
    reservation_id: Mapped[str | None] = mapped_column(
        ForeignKey("usage_reservations.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    available_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    lease_owner: Mapped[str | None] = mapped_column(String(160), nullable=True)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ExecutionTrace(Base):
    __tablename__ = "execution_traces"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        default=LOCAL_WORKSPACE_ID, index=True)
    test_run_id: Mapped[str] = mapped_column(
        ForeignKey("test_runs.id", ondelete="CASCADE"), index=True)
    step_number: Mapped[int] = mapped_column(Integer)
    step_type: Mapped[str] = mapped_column(String(30))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=now)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)


class FailureAnnotation(Base):
    __tablename__ = "failure_annotations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        default=LOCAL_WORKSPACE_ID, index=True)
    test_run_id: Mapped[str] = mapped_column(
        ForeignKey("test_runs.id", ondelete="CASCADE"), index=True)
    failure_type: Mapped[str] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(20))
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    detector_version: Mapped[str] = mapped_column(String(50), default="rules-v2")


class FindingReview(Base):
    __tablename__ = "finding_reviews"
    __table_args__ = (UniqueConstraint(
        "test_run_id", "reviewer_user_id", name="uq_finding_review_run_reviewer"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    test_run_id: Mapped[str] = mapped_column(
        ForeignKey("test_runs.id", ondelete="CASCADE"), index=True)
    reviewer_user_id: Mapped[str] = mapped_column(String, index=True)
    decision: Mapped[str] = mapped_column(String(30))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
