import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./evaluator.db")
SERVERLESS = os.getenv("SERVERLESS", "0") == "1"

options: dict = {"pool_pre_ping": True}

if DATABASE_URL.startswith("postgresql"):
    # Supabase's transaction pooler multiplexes connections, so a server-side
    # prepared statement created on one backend will not exist on the next —
    # psycopg3 prepares automatically after five executions and would start
    # failing mid-session. Disabling the threshold is the supported fix.
    options["connect_args"] = {"prepare_threshold": None}

if SERVERLESS:
    # Each invocation is its own short-lived process; a pool would hold connections
    # that the platform freezes and the pooler then has to reap.
    options["poolclass"] = NullPool

engine = create_engine(DATABASE_URL, **options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------------------------------- #
# Additive schema migration
# --------------------------------------------------------------------------- #
# `create_all` creates missing tables but never alters existing ones, so a column
# added to a model after a deployment exists is silently absent in production and
# every query mentioning it fails. There is no migration tool in this project and
# adding one the day before a deadline is its own risk, so the two additive columns
# are applied here — idempotently, and only additively. Nothing is ever dropped or
# rewritten by this.
NEW_COLUMNS: tuple[tuple[str, str, str], ...] = (
    ("scenarios", "run_kind", "VARCHAR(20) DEFAULT 'suite'"),
    ("test_runs", "provenance", "JSON"),
)


def ensure_columns() -> list[str]:
    """Add any model column the live table is missing. Returns what it added."""
    from sqlalchemy import inspect, text

    added: list[str] = []
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    for table, column, ddl in NEW_COLUMNS:
        if table not in existing_tables:
            continue                       # create_all will make it with the column
        if column in {c["name"] for c in inspector.get_columns(table)}:
            continue
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
        added.append(f"{table}.{column}")

    if "scenarios.run_kind" in added:
        # Backfill the rows written before the kind was recorded. They are
        # identifiable by the generator that wrote them, which is exactly the
        # coupling this column removes going forward.
        with engine.begin() as connection:
            connection.execute(text(
                "UPDATE scenarios SET run_kind = 'guardrail' "
                "WHERE generator_version LIKE 'guardrail%'"))
            connection.execute(text(
                "UPDATE scenarios SET run_kind = 'suite' WHERE run_kind IS NULL"))
    return added
