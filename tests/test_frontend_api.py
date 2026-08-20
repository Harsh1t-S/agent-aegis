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


def test_delete_agent_removes_it_and_its_runs(client):
    """The UI's delete must clear the runs too, or the dashboard keeps counting them."""
    agent = client.post("/api/agents", json={
        "name": "ui-doomed-agent", "systemPrompt": PROMPT, "tools": TOOLS}).json()
    client.post(f"/api/agents/{agent['id']}/evaluate", json={"perCategory": 1})
    before = client.get("/api/evaluations").json()
    assert any(e["agentId"] == agent["id"] for e in before)

    assert client.delete(f"/api/agents/{agent['id']}").status_code == 204

    assert client.get(f"/api/agents/{agent['id']}").status_code == 404
    assert agent["id"] not in [a["id"] for a in client.get("/api/agents").json()]
    after = client.get("/api/evaluations").json()
    assert not any(e["agentId"] == agent["id"] for e in after)


def test_delete_missing_agent_is_404(client):
    assert client.delete("/api/agents/does-not-exist").status_code == 404


def test_adversarial_toggle_gates_generation(client, ui_agent):
    """Off must remove adversarial scenarios, not quietly improve the score."""
    with_adv = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                           json={"versionLabel": "adv-on", "perCategory": 2,
                                 "adversarial": True}).json()
    without = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"versionLabel": "adv-off", "perCategory": 2,
                                "adversarial": False}).json()
    assert without["total"] < with_adv["total"]

    categories = {t["category"] for t in
                  client.get(f"/api/evaluations/{without['evaluationId']}").json()["tests"]}
    assert "adversarial" not in categories


def test_delete_agent_also_clears_its_scenarios(client):
    """Scenarios and sandboxes are minted per evaluation and must not outlive it."""
    agent = client.post("/api/agents", json={
        "name": "cascade-scenarios", "systemPrompt": "Never delete accounts.",
        "tools": [{"name": "get_order", "description": "Look up an order"},
                  {"name": "delete_account", "description": "Permanently delete an account"}],
    }).json()
    client.post(f"/api/agents/{agent['id']}/evaluate",
                json={"versionLabel": "v1", "perCategory": 2})

    before = len(client.get("/scenarios").json())
    assert client.delete(f"/api/agents/{agent['id']}").status_code == 204
    after = client.get("/scenarios").json()
    assert len(after) < before, "scenarios from the deleted agent were left behind"


def test_evaluation_list_rows_keep_the_typescript_shape(client, ui_agent):
    """The list endpoint is built from grouped queries rather than full evaluations,
    so it has to be pinned to the same keys the table renders."""
    client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                json={"versionLabel": "list-shape", "perCategory": 1})
    rows = client.get("/api/evaluations").json()
    assert rows, "an evaluation should be listed"
    required = {"id", "agentId", "agentName", "version", "score", "previousScore",
                "total", "passed", "failed", "warnings", "status", "date",
                "metrics", "failureBreakdown", "tests"}
    assert required <= set(rows[0])
    assert len(rows[0]["failureBreakdown"]) == 6
    assert rows[0]["status"] in {"completed", "running", "queued", "failed"}


def test_evaluation_list_counts_match_the_detail_view(client, ui_agent):
    started = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"versionLabel": "list-vs-detail", "perCategory": 1}).json()
    detail = client.get(f"/api/evaluations/{started['evaluationId']}").json()
    row = next(r for r in client.get("/api/evaluations").json()
               if r["id"] == started["evaluationId"])
    assert (row["passed"], row["failed"], row["warnings"]) == \
           (detail["passed"], detail["failed"], detail["warnings"])
    assert abs(row["score"] - detail["score"]) < 0.15


def test_duplicate_agent_name_is_a_conflict_not_a_server_error(client):
    """The name column is unique; the integrity error used to reach the user as a 500."""
    body = {"name": "duplicate-name-check", "systemPrompt": "You are a test agent.",
            "tools": [{"name": "get_order", "description": "Look up an order"}]}
    assert client.post("/api/agents", json=body).status_code == 201
    second = client.post("/api/agents", json=body)
    assert second.status_code == 409, second.text
    assert "already exists" in second.json()["detail"]


def test_list_metrics_match_the_detail_view(client, ui_agent):
    """Reported externally: the list returned every metric as 0 while the detail
    view showed real numbers, because the fast list stubbed them out."""
    started = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"versionLabel": "metrics-parity", "perCategory": 2}).json()
    detail = client.get(f"/api/evaluations/{started['evaluationId']}").json()
    row = next(r for r in client.get("/api/evaluations").json()
               if r["id"] == started["evaluationId"])
    assert any(v > 0 for v in row["metrics"].values()), "list metrics are all zero"
    for key, value in detail["metrics"].items():
        assert abs(row["metrics"][key] - value) < 1.5, f"{key}: {row['metrics'][key]} vs {value}"


def test_list_severity_matches_the_detail_view(client, ui_agent):
    """The list hardcoded every severity to 'low', so a critical failure was
    displayed as low next to a detail page calling it critical."""
    started = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"versionLabel": "severity-parity", "perCategory": 3}).json()
    detail = client.get(f"/api/evaluations/{started['evaluationId']}").json()
    row = next(r for r in client.get("/api/evaluations").json()
               if r["id"] == started["evaluationId"])
    detail_sev = {b["category"]: b["severity"] for b in detail["failureBreakdown"] if b["count"]}
    row_sev = {b["category"]: b["severity"] for b in row["failureBreakdown"] if b["count"]}
    for category, severity in detail_sev.items():
        assert row_sev.get(category) == severity, f"{category}: {row_sev.get(category)} vs {severity}"


def test_a_failed_scenario_never_claims_no_failures(client, ui_agent):
    """A red Failed badge beside "No failures detected in this scenario." reads
    like a broken tool rather than a verdict."""
    started = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"versionLabel": "explain-failures", "perCategory": 3}).json()
    detail = client.get(f"/api/evaluations/{started['evaluationId']}").json()
    contradictory = [t for t in detail["tests"]
                     if t["status"] == "failed"
                     and "no failures detected" in (t["explanation"] or "").lower()]
    assert not contradictory, [t["title"] for t in contradictory]


def test_tool_parameters_survive_create_and_read(client):
    """The importer parses a JSON-Schema block; dropping it cost scenarios their
    argument shape, so a call like issue_refund(order_id, amount) was generated bare."""
    params = {"type": "object",
              "properties": {"order_id": {"type": "string"}, "amount": {"type": "number"}},
              "required": ["order_id"]}
    agent = client.post("/api/agents", json={
        "name": "ui-schema-agent", "systemPrompt": PROMPT,
        "tools": [{"name": "issue_refund", "description": "Refund a customer",
                   "risk": "high", "parameters": params}]}).json()

    tool = next(t for t in agent["tools"] if t["name"] == "issue_refund")
    assert tool["parameters"] == params

    # and again on the read path, which is what an export re-imports from
    reread = client.get(f"/api/agents/{agent['id']}").json()
    assert next(t for t in reread["tools"] if t["name"] == "issue_refund")["parameters"] == params


def test_versions_carry_an_id_for_comparison(client, ui_agent):
    """The comparison endpoint keys on version ids, so the payload has to expose them."""
    client.post(f"/api/agents/{ui_agent['id']}/evaluate", json={"perCategory": 1,
                                                               "versionLabel": "v9"})
    versions = client.get(f"/api/agents/{ui_agent['id']}").json()["versions"]
    assert versions and all(v.get("id") for v in versions)

    if len(versions) >= 2:
        older, newer = versions[0]["id"], versions[-1]["id"]
        diff = client.get(f"/api/versions/{older}/compare/{newer}")
        assert diff.status_code == 200
        assert {"regressions", "improvements", "score_delta"} <= diff.json().keys()


def test_rerun_endpoint_queues_a_replay(client, ui_agent):
    """The trace page's Re-run test button had no reachable endpoint under /api,
    which is why it only ever raised a toast."""
    started = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"perCategory": 1}).json()
    detail = client.get(f"/api/evaluations/{started['evaluationId']}").json()
    assert detail["tests"], "need a completed run to re-run"

    original = detail["tests"][0]["id"]
    response = client.post(f"/api/test-runs/{original}/rerun")
    assert response.status_code == 202
    body = response.json()
    assert body["replayedFrom"] == original
    assert body["runId"] != original


def test_rerun_missing_run_is_404(client):
    assert client.post("/api/test-runs/nope/rerun").status_code == 404


def test_every_failing_scenario_carries_a_failure_class(client, ui_agent):
    """No run may fail without saying why.

    Ambiguous scenarios used to fail on the scorer's clarification rule while no
    detector fired, so the report showed `failureType: null` on a scenario it had
    just marked failed — a verdict with no stated reason.
    """
    started = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"perCategory": 3}).json()
    detail = client.get(f"/api/evaluations/{started['evaluationId']}").json()

    # Type alone is not a classification a developer can act on: the brief asks for
    # an actionable taxonomy, so severity and the remediation text are part of it.
    incomplete = [
        (t["title"], [field for field in ("failureType", "severity", "recommendation")
                      if not t.get(field)])
        for t in detail["tests"] if t["status"] != "passed"
    ]
    incomplete = [row for row in incomplete if row[1]]
    assert not incomplete, f"failures missing classification fields: {incomplete}"


def test_summary_and_detail_agree_after_a_rerun(client, ui_agent):
    """The evaluations table and the report must never disagree about one run.

    Reported by a judge: the same evaluation id read 42.3 over 12 scenarios in the
    list and 39.8 over 11 in the detail. The list aggregated *every* completed run
    while the detail kept the latest per scenario, so re-running one scenario
    counted it twice in one view and once in the other. For an evaluation product
    that is a measurement-integrity bug, not a cosmetic one.
    """
    started = client.post(f"/api/agents/{ui_agent['id']}/evaluate",
                          json={"perCategory": 2, "versionLabel": "consistency"}).json()
    evaluation_id = started["evaluationId"]

    def views():
        summary = next(e for e in client.get("/api/evaluations").json()
                       if e["id"] == evaluation_id)
        detail = client.get(f"/api/evaluations/{evaluation_id}").json()
        return summary, detail

    summary, detail = views()
    for field in ("score", "total", "passed", "failed", "warnings"):
        assert summary[field] == detail[field], f"{field}: {summary[field]} != {detail[field]}"

    # Re-run one scenario: a second completed run now exists for it.
    client.post(f"/api/test-runs/{detail['tests'][0]['id']}/rerun")

    summary, detail = views()
    assert summary["total"] == detail["total"] == len(detail["tests"]), (
        f"a re-run changed the scenario count: summary {summary['total']}, "
        f"detail {detail['total']}, tests {len(detail['tests'])}")
    for field in ("score", "passed", "failed", "warnings", "metrics"):
        assert summary[field] == detail[field], f"{field}: {summary[field]} != {detail[field]}"


def test_every_surface_reports_the_same_reliability(client):
    """One evaluation, one number, wherever it appears.

    Five surfaces each computed their own mean and only two applied the published
    ceilings, so a judge could read 30.0 on the report, 82.4 on the agent page and
    72.6 on the dashboard for the same run. For an evaluation product that is the
    most damaging class of bug there is.
    """
    agent = client.post("/api/agents", json={
        "name": "consistency-across-surfaces", "systemPrompt": PROMPT,
        "tools": TOOLS}).json()
    started = client.post(f"/api/agents/{agent['id']}/evaluate",
                          json={"perCategory": 3, "versionLabel": "surfaces"}).json()
    evaluation_id = started["evaluationId"]

    detail = client.get(f"/api/evaluations/{evaluation_id}").json()
    summary = next(e for e in client.get("/api/evaluations").json()
                   if e["id"] == evaluation_id)
    reread = client.get(f"/api/agents/{agent['id']}").json()
    version = next(v for v in reread["versions"] if v["id"] == evaluation_id)

    assert detail["score"] == summary["score"] == version["reliability"], {
        "report": detail["score"], "list": summary["score"],
        "agent page": version["reliability"]}

    # The agent's headline is its newest version, by the same definition.
    assert reread["reliability"] == reread["versions"][-1]["reliability"]

    # And previousScore has to be the previous version's canonical score, or the
    # report's own delta disagrees with the comparison page.
    if len(reread["versions"]) > 1:
        assert detail["previousScore"] == reread["versions"][-2]["reliability"]

    ceiling = client.get("/api/scoring").json()["safetyGate"]
    if any(t.get("severity") == "critical" and t.get("failureType") == "Unsafe Action"
           for t in detail["tests"]):
        for name, value in (("report", detail["score"]), ("list", summary["score"]),
                            ("agent page", version["reliability"])):
            assert value <= ceiling, f"{name} ignores the published cap: {value}"
