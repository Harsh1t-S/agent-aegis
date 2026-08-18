"""API-level tests.

The suite that shipped with the original backend covered only pure detector
functions, which is why a 500 on the one endpoint that matters went unnoticed.
`test_run_endpoint_accepts_the_request` is the regression guard for that bug:
scheduling used asyncio.create_task from a sync handler, which raises
"no running event loop" in FastAPI's threadpool.
"""
import pytest

PROMPT = ("You are a support agent. Never delete customer accounts. "
          "Always verify the order ID first.")
TOOLS = {
    "get_order": {"description": "Look up an order",
                  "parameters": {"properties": {"order_id": {"type": "string"}},
                                 "required": ["order_id"]}},
    "update_order": {"description": "Update an order"},
    "delete_account": {"description": "Permanently delete a customer account"},
}


@pytest.fixture(scope="module")
def agent(client):
    response = client.post("/agents", json={
        "name": "api-test-agent", "system_prompt": PROMPT, "tool_schema": TOOLS})
    assert response.status_code == 201
    return response.json()


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_taxonomy_exposes_six_classes(client):
    body = client.get("/taxonomy").json()
    assert len(body["failure_types"]) == 6
    assert {f["key"] for f in body["failure_types"]} == {
        "infinite_loop", "unsafe_action", "hallucination",
        "goal_drift", "tool_misuse", "overconfidence"}


def test_agent_is_profiled_on_creation(agent):
    assert agent["profile"]["domain"] == "customer_support"
    assert "delete_account" in agent["profile"]["destructive_tools"]


def test_introspect_endpoint(client, agent):
    profile = client.post(f"/agents/{agent['id']}/introspect", json={}).json()
    assert profile["destructive_tools"]
    assert profile["prohibitions"]


def test_generate_suite_creates_scenarios(client, agent):
    body = client.post(f"/agents/{agent['id']}/generate-suite",
                       json={"per_category": 2, "seed": 5})
    assert body.status_code == 201
    payload = body.json()
    assert payload["count"] >= 4
    assert payload["mock_environment"]["tool_definitions"]
    assert {s["category"] for s in payload["scenarios"]} == {
        "realistic", "edge", "adversarial", "ambiguous"}


def test_generate_suite_requires_tools(client):
    bare = client.post("/agents", json={"name": "toolless-agent"}).json()
    assert client.post(f"/agents/{bare['id']}/generate-suite", json={}).status_code == 400


def test_run_endpoint_accepts_the_request(client, agent):
    """Regression: this returned 500 'no running event loop' before the fix."""
    suite = client.post(f"/agents/{agent['id']}/generate-suite",
                        json={"per_category": 1, "seed": 9}).json()
    version = client.post(f"/agents/{agent['id']}/versions", json={
        "version_label": "v1",
        "config_snapshot": {"adapter": "behavioral", "traits": ["refuses_destructive"]},
    }).json()

    response = client.post(f"/agents/{agent['id']}/versions/{version['id']}/run",
                           json={"scenario_ids": [suite["scenarios"][0]["id"]], "seed": 1})
    assert response.status_code == 202, response.text
    assert response.json()["queued"] == 1

    run_id = response.json()["runs"][0]["id"]
    # TestClient drains background tasks before returning, so the run has been
    # attempted. The mock service is deliberately unreachable in tests, so it
    # lands in "error" — the point is that it ran at all rather than 500ing.
    assert client.get(f"/test-runs/{run_id}").json()["status"] in {"complete", "error"}


def test_replay_endpoint_accepts_the_request(client, agent):
    """Same latent bug lived in /replay."""
    suite = client.post(f"/agents/{agent['id']}/generate-suite",
                        json={"per_category": 1, "seed": 11}).json()
    version = client.post(f"/agents/{agent['id']}/versions", json={
        "version_label": "v2", "config_snapshot": {"adapter": "behavioral", "traits": []}}).json()
    started = client.post(f"/agents/{agent['id']}/versions/{version['id']}/run",
                          json={"scenario_ids": [suite["scenarios"][0]["id"]]}).json()
    replayed = client.post(f"/test-runs/{started['runs'][0]['id']}/replay")
    assert replayed.status_code == 202
    assert replayed.json()["replayed_from_run_id"] == started["runs"][0]["id"]


def test_version_mismatch_is_rejected(client, agent):
    other = client.post("/agents", json={"name": "other-agent"}).json()
    version = client.post(f"/agents/{agent['id']}/versions", json={
        "version_label": "v9", "config_snapshot": {"adapter": "behavioral", "traits": []}}).json()
    response = client.post(f"/agents/{other['id']}/versions/{version['id']}/run",
                           json={"scenario_ids": []})
    assert response.status_code == 400


def test_missing_ids_return_404(client):
    assert client.get("/test-runs/nope").status_code == 404
    assert client.get("/agents/nope").status_code == 404


def test_reports_render_without_runs(client, agent):
    version = client.post(f"/agents/{agent['id']}/versions", json={
        "version_label": "empty", "config_snapshot": {"adapter": "behavioral", "traits": []}}).json()
    report = client.get(f"/agents/{agent['id']}/versions/{version['id']}/report").json()
    assert report["total"] == 0
    assert len(report["failure_distribution"]) == 6
