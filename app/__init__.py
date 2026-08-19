"""Package init — applies serverless defaults before anything reads them.

Vercel's FastAPI preset imports `app.main` directly and never executes
`api/index.py`, so configuration set there silently did nothing: the app kept the
local SQLite default and failed on a read-only filesystem. Doing it here is
entrypoint-independent, because importing anything from this package runs it
first.

Every value uses setdefault, so a real environment variable always wins.
"""
import os

if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    os.environ.setdefault("SERVERLESS", "1")
    os.environ.setdefault("MOCK_INLINE", "1")
    os.environ.setdefault("SYNC_RUNS", "1")
    os.environ.setdefault("RUN_BUDGET_SECONDS", "20")
    os.environ.setdefault("MAX_WALL_SECONDS", "45")
