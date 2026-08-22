"""Package init — applies serverless defaults before anything reads them.

Vercel's FastAPI preset imports `app.main` directly and never executes
`api/index.py`, so configuration set there silently did nothing: the app kept the
local SQLite default and failed on a read-only filesystem. Doing it here is
entrypoint-independent, because importing anything from this package runs it
first.

Every value uses setdefault, so a real environment variable always wins.
"""
import os

#: Which credentials the process actually found, by name — never the value.
#:
#: Published by /health so "is this deployment configured?" has an answer that
#: does not require redeploying to find out. A missing DATABASE_URL is the
#: difference between a real database and an ephemeral file that loses every
#: write, and that is worth being able to check from outside.
CONFIG_SOURCE: dict[str, str] = {}

if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    os.environ.setdefault("SERVERLESS", "1")
    os.environ.setdefault("MOCK_INLINE", "1")
    os.environ.setdefault("SYNC_RUNS", "1")
    os.environ.setdefault("RUN_BUDGET_SECONDS", "20")
    os.environ.setdefault("MAX_WALL_SECONDS", "45")

    for key in ("DATABASE_URL", "GROQ_API_KEY", "GOOGLE_API_KEY"):
        CONFIG_SOURCE[key] = "environment" if os.getenv(key) else "not configured"
