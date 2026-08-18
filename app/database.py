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
