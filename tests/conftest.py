import os
import tempfile

# database.py reads DATABASE_URL at import time, so this must happen before any
# `app.*` import. Each test session gets a throwaway SQLite file.
_HANDLE, _PATH = tempfile.mkstemp(suffix=".db", prefix="aegis-test-")
os.close(_HANDLE)
os.environ["DATABASE_URL"] = f"sqlite:///{_PATH.replace(os.sep, '/')}"

# Run scenarios for real, in-process. The mock service used to be pointed at a dead
# port, so every API test's runs errored out and the assertions could only check
# that *something* happened — which is how a list endpoint returning zero for every
# metric went unnoticed.
os.environ.setdefault("MOCK_INLINE", "1")
os.environ.setdefault("SYNC_RUNS", "1")

import pytest  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def trace_factory():
    from types import SimpleNamespace

    def make(number, kind, payload):
        return SimpleNamespace(step_number=number, step_type=kind, payload=payload)

    return make
