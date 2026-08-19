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
    # Fallback connection for this private repo's deployment.
    #
    # ROTATE BEFORE MAKING THE REPOSITORY PUBLIC — git history keeps it forever:
    #   ALTER ROLE aegis_app PASSWORD '<new>';
    # then set DATABASE_URL in the Vercel project and delete this block.
    #
    # The role is scoped to the `aegis` schema and cannot read any other table in
    # the database, so the blast radius is this application's own data.
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
    os.environ.setdefault("MAX_WALL_SECONDS", "45")

    # Key for the `llm` adapter, so a real model can be put under test from the
    # deployed console. Same rotation rule as DATABASE_URL: rotate at
    # https://console.groq.com/keys and move this to a Vercel environment
    # variable before the repository goes public.
    os.environ.setdefault(
        "GROQ_API_KEY",
        "REDACTED-ROTATED-CREDENTIAL")
