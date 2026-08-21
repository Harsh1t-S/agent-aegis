"""Vercel serverless entrypoint.

A serverless invocation is a short-lived process with no sibling services and no
guarantee of surviving its own response, so three things change from the local
setup — all of them switched in `app/__init__.py` rather than here, because
Vercel's FastAPI preset imports `app.main` directly and never executes this file:

* `MOCK_INLINE`  — import the sandbox instead of calling a second HTTP service.
* `SYNC_RUNS`    — execute scenarios inside the request; background tasks would be
                   frozen the moment the function responds.
* `SERVERLESS`   — NullPool and batched trace writes, because a connection pool
                   outlives nothing here and every commit is a network round-trip.

`RUN_BUDGET_SECONDS` caps how much of a suite one invocation attempts. Whatever is
left stays queued and is drained by the progress endpoint the dashboard polls.

`DATABASE_URL` must be set in the Vercel project's environment variables. There is
deliberately no fallback in source: a committed connection string is permanent in
git history. Without it the app falls back to SQLite on an ephemeral filesystem,
which loses every write between invocations — `/health` says so explicitly.
"""
from app.main import app  # noqa: F401

__all__ = ["app"]
