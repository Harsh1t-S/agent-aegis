"""Package init — applies serverless defaults before anything reads them.

Vercel's FastAPI preset imports `app.main` directly and never executes
`api/index.py`, so configuration set there silently did nothing: the app kept the
local SQLite default and failed on a read-only filesystem. Doing it here is
entrypoint-independent, because importing anything from this package runs it
first.

Every value uses setdefault, so a real environment variable always wins.

No credential is written in this file, or in any other application module. While
the repository is private the deployment's fallbacks live in exactly one place —
`app/deployment_config.py` — which carries the rotate-and-delete checklist. Once
the Vercel project has DATABASE_URL, GROQ_API_KEY and GOOGLE_API_KEY set, that file
can be deleted outright and nothing here changes: the import is optional and its
absence just means the environment is the only source.
"""
import os

#: Where each credential actually came from, by name — never the value itself.
#:
#: "environment" means the platform supplied it and the bundled fallback was
#: ignored; "bundled fallback" means the committed file is what is holding the
#: deployment up, and deleting it would break production. Published by /health so
#: that question has an answer that does not require guessing, redeploying to find
#: out, or reading a secret to check.
CONFIG_SOURCE: dict[str, str] = {}

if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    os.environ.setdefault("SERVERLESS", "1")
    os.environ.setdefault("MOCK_INLINE", "1")
    os.environ.setdefault("SYNC_RUNS", "1")
    os.environ.setdefault("RUN_BUDGET_SECONDS", "20")
    os.environ.setdefault("MAX_WALL_SECONDS", "45")

    try:
        from .deployment_config import FALLBACKS
    except ImportError:
        # The file has been removed for a public repository. The environment is
        # then the only source, which is the intended end state.
        FALLBACKS = {}

    for key, value in FALLBACKS.items():
        CONFIG_SOURCE[key] = "environment" if os.getenv(key) else "bundled fallback"
        if value:
            os.environ.setdefault(key, value)

    # Anything the fallback file no longer carries is environment-only by
    # definition, and worth reporting as present or missing.
    for key in ("DATABASE_URL", "GROQ_API_KEY", "GOOGLE_API_KEY"):
        CONFIG_SOURCE.setdefault(
            key, "environment" if os.getenv(key) else "not configured")
