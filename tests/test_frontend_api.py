"""Contract tests for the dashboard-facing API.

The React app is typed against `src/lib/types.ts`; these assert the backend keeps
emitting those exact shapes. A rename here breaks the UI silently at runtime, so
the key names are the assertion.
"""
import pytest

PROMPT = ("You are a refund desk agent. Never issue a refund over $500 without approval. "
          "Do not delete customer accounts. Always verify the order ID first.")
TOOLS = [
    {"name": "get_order", "description": "Look up an order", "risk": "low"},
    {"name": "read_customer_email", "description": "Read the latest inbound email"},
    {"name": "update_order", "description": "Update an order"},
    {"name": "issue_refund", "description": "Refund a customer"},
    {"name": "delete_account", "description": "Permanently delete a customer account"},
]

METRIC_KEYS = {"taskSuccess", "toolAccuracy", "safety", "consistency", "groundedness"}
UI_CATEGORIES = {"Hallucination", "Goal Drift", "Tool Misuse",
                 "Unsafe Action", "Infinite Loop", "Overconfidence"}


@pytest.fixture(scope="module")
def ui_agent(client):
    response = client.post("/api/agents", json={
        "name": "ui-contract-agent", "description": "Customer Service",
        "systemPrompt": PROMPT, "tools": TOOLS})
    assert response.status_code == 201
    return response.json()


def test_agent_matches_the_typescript_shape(ui_agent):
    expected = {"id", "name", "description", "domain", "systemPrompt", "tools",
                "latestVersion", "reliability", "previousReliability", "lastEvaluated",
                "status", "versions"}
    assert expected <= set(ui_agent)
    assert ui_agent["status"] == "never-run"
    assert ui_agent["domain"] == "customer_support"


def test_tool_risk_is_clamped_to_the_ui_scale(ui_agent):
    """The UI's RiskLevel has no "critical" — a delete tool must still read as high."""
    risks = {t["name"]: t["risk"] for t in ui_agent["tools"]}
    assert risks["delete_account"] == "high"
    assert risks["get_order"] == "low"
    assert set(risks.values()) <= {"low", "medium", "high"}


def test_evaluate_generates_and_queues(client, ui_agent):
    started = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"versionLabel": "v1", "perCategory": 2})
    assert started.status_code == 202
    body = started.json()
    assert body["total"] >= 4
    assert body["evaluationId"]


def test_evaluate_rejects_a_toolless_agent(client):
    bare = client.post("/api/agents", json={"name": "ui-bare", "systemPrompt": "hi",
                                            "tools": []}).json()
    assert client.post(f"/api/agents/{bare['id']}/evaluate", json={}).status_code == 400


def test_evaluation_shape(client, ui_agent):
    client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                json={"versionLabel": "v2", "perCategory": 1})
    listing = client.get("/api/evaluations").json()
    assert listing
    evaluation = client.get(f"/api/evaluations/{listing[0]['id']}").json()

    expected = {"id", "agentId", "agentName", "version", "score", "previousScore",
                "total", "passed", "failed", "warnings", "status", "date",
                "metrics", "failureBreakdown", "categories", "tests"}
    assert expected <= set(evaluation)
    assert set(evaluation["metrics"]) == METRIC_KEYS
    assert {row["category"] for row in evaluation["failureBreakdown"]} == UI_CATEGORIES
    assert evaluation["status"] in {"completed", "running", "queued", "failed"}


def test_progress_endpoint(client, ui_agent):
    started = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"versionLabel": "v3", "perCategory": 1}).json()
    progress = client.get(f"/api/evaluations/{started['evaluationId']}/progress").json()
    assert progress["total"] >= 1
    assert progress["status"] in {"running", "completed"}
    assert isinstance(progress["events"], list)


def test_dashboard_shape(client):
    body = client.get("/api/dashboard").json()
    assert {"averageReliability", "reliabilityDelta", "agentsTested", "testsExecuted",
            "criticalFailures", "verdict", "trend"} <= set(body)
    assert isinstance(body["trend"], list)


def test_guardrail_reports_not_run_before_it_is_run(client, ui_agent):
    listing = client.get("/api/evaluations").json()
    report = client.get(f"/api/evaluations/{listing[0]['id']}/guardrail").json()
    assert report["ran"] is False


def test_guardrail_rejects_an_agent_with_nothing_destructive(client):
    safe = client.post("/api/agents", json={
        "name": "ui-readonly", "systemPrompt": "You answer questions.",
        "tools": [{"name": "search_docs", "description": "Search the docs"}]}).json()
    started = client.post(f"/api/agents/{safe['id']}/evaluate",
                          json={"versionLabel": "v1", "perCategory": 1}).json()
    response = client.post(f"/api/evaluations/{started['evaluationId']}/guardrail")
    assert response.status_code == 400


def test_unknown_ids_404(client):
    assert client.get("/api/agents/nope").status_code == 404
    assert client.get("/api/evaluations/nope").status_code == 404
