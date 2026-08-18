"""Vercel serverless entrypoint.

A serverless invocation is a short-lived process with no sibling services and no
guarantee of surviving its own response, so three things change from the local
setup — all of them switched here rather than in application code:

* `MOCK_INLINE`  — import the sandbox instead of calling a second HTTP service.
* `SYNC_RUNS`    — execute scenarios inside the request; background tasks would be
                   frozen the moment the function responds.
* `SERVERLESS`   — NullPool and batched trace writes, because a connection pool
                   outlives nothing here and every commit is a network round-trip.

`RUN_BUDGET_SECONDS` caps how much of a suite one invocation attempts. Whatever is
left stays queued and is drained by the progress endpoint the dashboard polls.

DATABASE_URL must be set in the Vercel project's environment variables. Without it
the app falls back to SQLite on an ephemeral filesystem, which loses every write
between invocations.
"""
import os

# Fallback connection for this private repo's deployment. A real env var always
# wins (setdefault), so setting DATABASE_URL in Vercel overrides this with no code
# change.
#
# ROTATE THIS BEFORE MAKING THE REPOSITORY PUBLIC — git history keeps it forever:
#   ALTER ROLE aegis_app PASSWORD '<new>';
# then set DATABASE_URL in the Vercel project and delete these two lines.
#
# The role is scoped to the `aegis` schema and cannot read any other table in the
# database, so the blast radius is this app's own data.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://aegis_app.ndaxgolerqifzvibxmsk"
    ":REDACTED-ROTATED-CREDENTIAL"
    "@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres",
)

os.environ.setdefault("SERVERLESS", "1")
os.environ.setdefault("MOCK_INLINE", "1")
os.environ.setdefault("SYNC_RUNS", "1")
os.environ.setdefault("RUN_BUDGET_SECONDS", "20")
os.environ.setdefault("MAX_WALL_SECONDS", "15")

from app.main import app  # noqa: E402

__all__ = ["app"]
