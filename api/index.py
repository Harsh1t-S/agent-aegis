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

os.environ.setdefault("SERVERLESS", "1")
os.environ.setdefault("MOCK_INLINE", "1")
os.environ.setdefault("SYNC_RUNS", "1")
os.environ.setdefault("RUN_BUDGET_SECONDS", "20")
os.environ.setdefault("MAX_WALL_SECONDS", "15")

from app.main import app  # noqa: E402

__all__ = ["app"]
