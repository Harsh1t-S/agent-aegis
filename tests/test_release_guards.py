import asyncio
import json
from uuid import uuid4

import httpx
import pytest

from app.adapters import LLMAgentAdapter
from app.database import SessionLocal
from app.models import TestRun as RunRecord

OWNER_KEY = "synthetic-owner-key-for-regression-tests"


@pytest.fixture
def locked(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("AEGIS_ADMIN_KEY", OWNER_KEY)
    return {"Authorization": f"Bearer {OWNER_KEY}"}


@pytest.mark.parametrize("method,path", [
    ("post", "/api/agents"), ("patch", "/api/agents/example"),
    ("delete", "/api/agents/example"), ("post", "/api/agents/example/evaluate"),
    ("post", "/api/test-runs/example/rerun"), ("post", "/api/evaluations/example/guardrail"),
    ("post", "/agents"), ("post", "/agents/example/versions/example/run"),
    ("post", "/mock-environments"), ("post", "/test-runs/example/replay"),
    ("get", "/agents/example"), ("get", "/agents/example/versions"),
])
def test_owner_required_on_dashboard_and_legacy_mutations(client, locked, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 401
    assert OWNER_KEY not in response.text


def test_missing_owner_configuration_is_read_only_on_vercel(client, monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.delenv("AEGIS_ADMIN_KEY", raising=False)
    assert client.post("/api/agents", json={"name": "unsafe"}).status_code == 503
    assert client.get("/api/agents").status_code == 200
    access = client.get("/api/access")
    assert access.json() == {"required": True, "configured": False, "authorized": False,
                             "keyReceived": False}
    assert access.headers["cache-control"] == "no-store"


def test_valid_owner_can_unlock_and_write_without_exposing_key(client, locked):
    assert client.get("/api/access", headers=locked).json()["authorized"] is True
    assert client.get("/api/access", headers={"Authorization": "Bearer wrong"}).json()["authorized"] is False
    response = client.post("/api/agents", headers=locked, json={"name": f"owner-{uuid4()}"})
    assert response.status_code == 201
    assert OWNER_KEY not in response.text


def test_access_distinguishes_missing_and_incorrect_keys_without_disclosing_secrets(client, locked):
    missing = client.get("/api/access")
    wrong = client.get("/api/access", headers={"Authorization": "Bearer synthetic-wrong-key"})
    valid = client.get("/api/access", headers=locked)
    assert missing.json()["keyReceived"] is False
    assert missing.json()["authorized"] is False
    assert wrong.json()["keyReceived"] is True
    assert wrong.json()["authorized"] is False
    assert valid.json()["keyReceived"] is True
    assert valid.json()["authorized"] is True
    for response in [missing, wrong, valid]:
        assert OWNER_KEY not in response.text
        assert "synthetic-wrong-key" not in response.text
        assert response.headers["cache-control"] == "no-store"


def test_public_progress_and_trace_reads_never_execute_queued_work(client, monkeypatch):
    monkeypatch.setattr("app.frontend_api.drain_pending", lambda *_args: 0)
    agent = client.post("/api/agents", json={"name": f"queued-{uuid4()}",
        "systemPrompt": "Never delete accounts.", "tools": [{"name": "delete_account"}]}).json()
    evaluation = client.post(f"/api/agents/{agent['id']}/evaluate", json={"perCategory": 1}).json()["evaluationId"]
    with SessionLocal() as db:
        run_id = db.query(RunRecord).filter_by(agent_version_id=evaluation).first().id
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("AEGIS_ADMIN_KEY", OWNER_KEY)
    executions = []
    monkeypatch.setattr("app.frontend_api.drain_pending", lambda *_args: executions.append("drain"))
    async def run(*_args):
        executions.append("run")
    monkeypatch.setattr("app.frontend_api.run_test", run)
    progress = client.get(f"/api/evaluations/{evaluation}/progress").json()
    trace = client.get(f"/api/evaluations/{evaluation}/tests/{run_id}").json()
    assert client.get(f"/api/evaluations/{evaluation}/guardrail").status_code == 200
    assert progress["canContinue"] is False
    assert trace["canContinue"] is False
    assert trace["status"] == "pending"
    assert executions == []
    client.get(f"/api/evaluations/{evaluation}/progress", headers={"Authorization": f"Bearer {OWNER_KEY}"})
    assert executions == ["drain"]


@pytest.fixture
def providers(monkeypatch):
    for name in ("LLM_MODEL", "LLM_BASE_URL", "LLM_API_KEY", "LLM_FALLBACK_MODELS"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("AIROUTER_API_KEY", "synthetic-airouter-key")
    monkeypatch.setenv("GROQ_API_KEY", "synthetic-groq-key")
    monkeypatch.setenv("GOOGLE_API_KEY", "synthetic-google-key")


def mock_provider(monkeypatch, responder):
    real_client = httpx.AsyncClient
    monkeypatch.setattr("app.adapters.httpx.AsyncClient", lambda **kwargs: real_client(
        **kwargs, transport=httpx.MockTransport(responder)))


def test_healthy_airouter_is_first_for_every_scenario(providers, monkeypatch):
    requests = []
    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "Done"}}]})
    mock_provider(monkeypatch, respond)
    for rotation in range(6):
        asyncio.run(LLMAgentAdapter(rotation=rotation).next_action([], {}))
    assert {request.url.host for request in requests} == {"api.airouter.in"}
    assert {json.loads(request.content)["model"] for request in requests} == {"openai/gpt-5.6-luna-fast"}


@pytest.mark.parametrize("status", [401, 402, 403, 404, 429, 500, 503])
def test_provider_failure_uses_configured_fallback_and_its_own_key(providers, monkeypatch, status):
    requests = []
    def respond(request):
        requests.append(request)
        if request.url.host == "api.airouter.in":
            return httpx.Response(status, json={"error": "Unavailable"})
        assert request.headers["authorization"] == "Bearer synthetic-groq-key"
        return httpx.Response(200, json={"choices": [{"message": {"content": "Fallback answer"}}]})
    mock_provider(monkeypatch, respond)
    adapter = LLMAgentAdapter(rotation=11)
    assert asyncio.run(adapter.next_action([], {}))["content"] == "Fallback answer"
    assert [request.url.host for request in requests] == ["api.airouter.in", "api.groq.com"]
    assert adapter.served_by == ["groq:openai/gpt-oss-20b"]


def test_timeout_can_reach_fallback_within_the_engine_budget(providers, monkeypatch):
    requests = []
    def respond(request):
        requests.append(request.url.host)
        if request.url.host == "api.airouter.in":
            raise httpx.ReadTimeout("Synthetic timeout", request=request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "Fallback answer"}}]})
    mock_provider(monkeypatch, respond)
    assert asyncio.run(LLMAgentAdapter().next_action([], {}))["content"] == "Fallback answer"
    assert requests == ["api.airouter.in", "api.groq.com"]


def test_bad_request_is_not_hidden_by_switching_models(providers, monkeypatch):
    requests = []
    def respond(request):
        requests.append(request)
        return httpx.Response(400, json={"error": "Invalid tool schema"})
    mock_provider(monkeypatch, respond)
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(LLMAgentAdapter().next_action([], {}))
    assert len(requests) == 1


def test_empty_fallback_setting_disables_fallbacks(providers, monkeypatch):
    monkeypatch.setenv("LLM_FALLBACK_MODELS", "")
    assert LLMAgentAdapter.default_pool() == [LLMAgentAdapter.DEFAULT_MODEL]


def test_ci_waits_for_all_guardrail_probes(monkeypatch):
    from app.ci import guardrail_resistance
    monkeypatch.setattr("app.ci.time.sleep", lambda _: None)
    polls = []
    def respond(request):
        if request.method == "POST":
            return httpx.Response(202, json={"queued": 3})
        polls.append(1)
        return httpx.Response(200, json={"pending": 3 - len(polls),
            "resistanceScore": 100 if len(polls) == 3 else None})
    with httpx.Client(base_url="https://api.example.test", transport=httpx.MockTransport(respond)) as client:
        assert guardrail_resistance(client, "evaluation")["resistanceScore"] == 100
    assert len(polls) == 3


def test_ci_does_not_gate_on_an_unfinished_unauthorized_ladder():
    from app.ci import guardrail_resistance
    with httpx.Client(base_url="https://api.example.test", transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"pending": 4, "canContinue": False}))) as client:
        assert guardrail_resistance(client, "evaluation") is None
