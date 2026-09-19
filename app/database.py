import os

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, with_loader_criteria
from sqlalchemy.pool import NullPool

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./evaluator.db")
SERVERLESS = os.getenv("SERVERLESS", "0") == "1"
IS_POSTGRES = DATABASE_URL.startswith("postgresql")

options: dict = {"pool_pre_ping": True}

if IS_POSTGRES:
    # Supabase's transaction pooler multiplexes connections, so a server-side
    # prepared statement created on one backend may not exist on the next.
    options["connect_args"] = {
        "prepare_threshold": None,
        # Application models intentionally remain schema-agnostic for SQLite
        # tests. Pin every Postgres connection to the private application schema
        # instead of relying on a URL-specific `options` query parameter.
        "options": "-csearch_path=aegis,public",
    }

if SERVERLESS:
    # Each invocation is a short-lived process. Holding connections while the
    # platform freezes an invocation exhausts a small Supabase pool quickly.
    options["poolclass"] = NullPool

engine = create_engine(DATABASE_URL, **options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


if not IS_POSTGRES:
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(connection, connection_record) -> None:  # noqa: ARG001
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


class Base(DeclarativeBase):
    pass


@event.listens_for(SessionLocal, "after_begin")
def _apply_request_context(session, transaction, connection) -> None:  # noqa: ARG001
    """Re-apply tenant context after every commit.

    PostgreSQL SET LOCAL values end with the transaction. Several evaluation
    endpoints commit while constructing a suite, so setting context once at the
    start of a request is not sufficient.
    """
    if connection.dialect.name != "postgresql":
        return
    user_id = session.info.get("user_id") or ""
    workspace_id = session.info.get("workspace_id") or ""
    connection.execute(
        text("select set_config('app.current_user_id', :user_id, true), "
             "set_config('app.current_workspace_id', :workspace_id, true), "
             "set_config('app.current_user_email', :user_email, true), "
             "set_config('app.worker', :worker, true)"),
        {"user_id": user_id, "workspace_id": workspace_id,
         "user_email": session.info.get("user_email") or "",
         "worker": "true" if session.info.get("worker") else "false"},
    )


def _tenant_models():
    from .models import (
        Agent,
        AgentVersion,
        AuditEvent,
        EvaluationJob,
        ExecutionTrace,
        FailureAnnotation,
        FindingReview,
        MockEnvironment,
        NotificationDelivery,
        ReportShare,
        Scenario,
        TestRun,
        UsageEvent,
        UsageReservation,
        WorkspaceApiKey,
    )
    return (
        Agent, AgentVersion, AuditEvent, EvaluationJob, ExecutionTrace,
        FailureAnnotation, FindingReview, MockEnvironment, NotificationDelivery, ReportShare,
        Scenario, TestRun,
        UsageEvent, UsageReservation, WorkspaceApiKey,
    )


@event.listens_for(SessionLocal, "do_orm_execute")
def _scope_tenant_reads(execute_state) -> None:
    workspace_id = execute_state.session.info.get("workspace_id")
    if (not workspace_id or not execute_state.is_select
            or execute_state.execution_options.get("include_all_workspaces")):
        return
    statement = execute_state.statement
    for model in _tenant_models():
        statement = statement.options(with_loader_criteria(
            model,
            lambda row: row.workspace_id == workspace_id,
            include_aliases=True,
        ))
    execute_state.statement = statement


@event.listens_for(SessionLocal, "before_flush")
def _scope_tenant_inserts(session, flush_context, instances) -> None:  # noqa: ARG001
    workspace_id = session.info.get("workspace_id")
    if not workspace_id:
        return
    for row in session.new:
        if hasattr(row, "workspace_id") and not getattr(row, "workspace_id", None):
            row.workspace_id = workspace_id


def set_session_context(db, *, user_id: str | None = None,
                        user_email: str | None = None,
                        workspace_id: str | None = None,
                        worker: bool | None = None) -> None:
    if user_id is not None:
        db.info["user_id"] = user_id
    if user_email is not None:
        db.info["user_email"] = user_email
    if workspace_id is not None:
        db.info["workspace_id"] = workspace_id
    if worker is not None:
        db.info["worker"] = worker
    if IS_POSTGRES and db.in_transaction():
        db.execute(
            text("select set_config('app.current_user_id', :user_id, true), "
                 "set_config('app.current_workspace_id', :workspace_id, true), "
                 "set_config('app.current_user_email', :user_email, true), "
                 "set_config('app.worker', :worker, true)"),
            {"user_id": db.info.get("user_id", ""),
             "workspace_id": db.info.get("workspace_id", ""),
             "user_email": db.info.get("user_email", ""),
             "worker": "true" if db.info.get("worker") else "false"},
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _seed_local_workspace() -> None:
    """Create the single-user local workspace used by tests and offline demos."""
    from .models import (
        LOCAL_ORGANIZATION_ID,
        LOCAL_USER_ID,
        LOCAL_WORKSPACE_ID,
        Organization,
        OrganizationMembership,
        Subscription,
        UserProfile,
        Workspace,
    )

    db = SessionLocal()
    try:
        if db.get(UserProfile, LOCAL_USER_ID) is None:
            db.add(UserProfile(id=LOCAL_USER_ID, email="local@aegis.invalid",
                               display_name="Local user"))
        if db.get(Organization, LOCAL_ORGANIZATION_ID) is None:
            db.add(Organization(
                id=LOCAL_ORGANIZATION_ID,
                name="Local organization",
                slug="local",
                created_by=LOCAL_USER_ID,
                billing_email="local@aegis.invalid",
            ))
        db.flush()
        membership = (
            db.query(OrganizationMembership)
            .filter_by(organization_id=LOCAL_ORGANIZATION_ID, user_id=LOCAL_USER_ID)
            .first()
        )
        if membership is None:
            db.add(OrganizationMembership(
                organization_id=LOCAL_ORGANIZATION_ID,
                user_id=LOCAL_USER_ID,
                role="owner",
            ))
        if db.get(Workspace, LOCAL_WORKSPACE_ID) is None:
            db.add(Workspace(
                id=LOCAL_WORKSPACE_ID,
                organization_id=LOCAL_ORGANIZATION_ID,
                name="Local workspace",
                slug="local",
                settings={
                    "scenariosPerRun": 12,
                    "adversarial": True,
                    "adapter": "behavioral",
                },
            ))
        if db.get(Subscription, LOCAL_ORGANIZATION_ID) is None:
            # Local development is unlimited so product tests do not depend on a
            # billing provider. Hosted users are created on the bounded trial.
            db.add(Subscription(
                organization_id=LOCAL_ORGANIZATION_ID,
                provider="local",
                plan="development",
                status="active",
            ))
        db.commit()
    finally:
        db.close()


def initialize_database() -> list[str]:
    """Initialise SQLite only; hosted Postgres is changed by versioned migrations."""
    auto_create = os.getenv(
        "AEGIS_AUTO_CREATE_SCHEMA", "0" if IS_POSTGRES else "1") == "1"
    if auto_create:
        Base.metadata.create_all(bind=engine)
        _seed_local_workspace()
        return ["metadata"] if not IS_POSTGRES else ["metadata-override"]

    # Fail clearly when code is deployed before its migration rather than writing
    # a partly upgraded schema from application startup.
    required = {
        "organizations", "workspaces", "organization_memberships",
        "subscriptions", "workspace_api_keys", "audit_events",
        "evaluation_jobs", "usage_reservations", "usage_events",
        "notification_deliveries", "report_shares",
    }
    present = set(inspect(engine).get_table_names())
    missing = sorted(required - present)
    if missing:
        raise RuntimeError(
            "Database migrations are required before this release can serve traffic. "
            f"Missing tables: {', '.join(missing)}")
    return []


# Kept as a compatibility alias for callers on the previous release.
def ensure_columns() -> list[str]:
    return initialize_database()
