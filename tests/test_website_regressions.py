"""Regressions for form submissions, permanent trace links and dashboard data."""
from datetime import datetime
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal
from app.frontend_api import dashboard
from app.models import Agent, AgentVersion, ExecutionTrace, MockEnvironment, Scenario, TestRun as RunRecord


def create_agent(client, **overrides):
    return client.post("/api/agents", json={
        "name": f"website-{uuid4()}", "systemPrompt": "Look up the order.",
        "tools": [{"name": "get_order", "description": "Look up an order"}], **overrides,
    })


@pytest.mark.parametrize("name", [" ", "a" * 201])
def test_invalid_agent_names_rejected_on_create_and_edit(client, name):
    assert create_agent(client, name=name).status_code == 422
    agent = create_agent(client).json()
    assert client.patch(f"/api/agents/{agent['id']}", json={"name": name}).status_code == 422
    assert client.get(f"/api/agents/{agent['id']}").json()["name"] == agent["name"]


def test_agent_names_are_normalized_before_uniqueness_check(client):
    agent = create_agent(client).json()
    assert create_agent(client, name=f"  {agent['name']}  ").status_code == 409


@pytest.mark.parametrize("tools", [
    [{"name": "get_order"}, {"name": " get_order "}],
    [{"name": " "}],
])
def test_invalid_tool_names_never_overwrite_schema(client, tools):
    assert create_agent(client, tools=tools).status_code == 422
    agent = create_agent(client).json()
    response = client.patch(f"/api/agents/{agent['id']}", json={"tools": tools})
    assert response.status_code == 422
    assert client.get(f"/api/agents/{agent['id']}").json()["tools"] == agent["tools"]


def test_trace_permalink_survives_reruns_and_keeps_complete_evidence(client):
    agent = create_agent(client).json()
    evaluation = client.post(f"/api/agents/{agent['id']}/evaluate", json={
        "adapter": "behavioral", "perCategory": 1,
    }).json()["evaluationId"]
    report = client.get(f"/api/evaluations/{evaluation}").json()
    original = report["tests"][0]["id"]
    evidence = "context " * 100 + "CRITICAL EVIDENCE AT END"
    with SessionLocal() as db:
        db.add(ExecutionTrace(test_run_id=original, step_number=100,
                              step_type="tool_result", payload={"result": evidence}))
        db.commit()
    replacement = client.post(f"/api/test-runs/{original}/rerun").json()["runId"]
    latest = client.get(f"/api/evaluations/{evaluation}").json()
    assert original not in [test["id"] for test in latest["tests"]]
    for run_id in (original, replacement):
        response = client.get(f"/api/evaluations/{evaluation}/tests/{run_id}")
        assert response.status_code == 200
        assert response.json()["test"]["id"] == run_id
        assert response.json()["status"] == "complete"
    trace = client.get(f"/api/evaluations/{evaluation}/tests/{original}").json()["test"]["trace"]
    assert trace[-1]["detail"] == evidence
    assert client.get(f"/api/evaluations/wrong-version/tests/{original}").status_code == 404


def test_pending_trace_read_is_observational_only(client, monkeypatch):
    # Reproduce a POST which returns before it reaches this run. The durable
    # worker, rather than a report GET, is responsible for advancing it.
    monkeypatch.setattr("app.frontend_api.drain_pending", lambda *_args: 0)
    agent = create_agent(client).json()
    evaluation = client.post(f"/api/agents/{agent['id']}/evaluate", json={
        "adapter": "behavioral", "perCategory": 1,
    }).json()["evaluationId"]
    with SessionLocal() as db:
        run_id = db.query(RunRecord).filter_by(agent_version_id=evaluation).first().id
    response = client.get(f"/api/evaluations/{evaluation}/tests/{run_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert response.json()["test"] is None


def test_dashboard_includes_zero_scores_and_orders_dates_chronologically():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        agent = Agent(name="evaluated")
        db.add_all([agent, Agent(name="never evaluated")])
        environment = MockEnvironment(name="demo", tool_definitions={})
        db.add(environment)
        db.flush()
        scenario = Scenario(name="demo", initial_prompt="Test", mock_environment_id=environment.id)
        db.add(scenario)
        db.flush()
        for date, score in [(datetime(2025, 12, 31), 100), (datetime(2026, 1, 1), 0),
                            (datetime(2026, 2, 1), 50), (datetime(2026, 3, 1), None)]:
            version = AgentVersion(agent_id=agent.id, version_label=date.isoformat(), created_at=date)
            db.add(version)
            db.flush()
            db.add(RunRecord(agent_version_id=version.id, scenario_id=scenario.id,
                           status="complete" if score is not None else "pending",
                           completed_at=date if score is not None else None,
                           reliability_score=score, outcome="pass" if score else "fail"))
        db.commit()
        summary = dashboard(db)
        assert summary["averageReliability"] == 50
        assert summary["evaluations"] == 3
        assert summary["agentsTested"] == 1
        assert [point["score"] for point in summary["trend"]] == [100, 0, 50]
        assert summary["reliabilityDelta"] == 0
        assert summary["latestVersionDelta"] == 50
    engine.dispose()


def test_agent_cards_distinguish_pending_and_execution_errors_from_scores(client, monkeypatch):
    monkeypatch.setattr("app.frontend_api.drain_pending", lambda *_args: 0)
    agent = create_agent(client).json()
    evaluation = client.post(f"/api/agents/{agent['id']}/evaluate", json={
        "adapter": "behavioral", "perCategory": 1,
    }).json()["evaluationId"]
    pending = client.get(f"/api/agents/{agent['id']}").json()
    assert pending["status"] == "running"
    assert pending["versions"][-1]["status"] == "running"
    with SessionLocal() as db:
        runs = db.query(RunRecord).filter_by(agent_version_id=evaluation).all()
        for run in runs:
            run.status = "error"
            run.completed_at = datetime(2026, 9, 16)
            db.add(ExecutionTrace(test_run_id=run.id, step_number=0, step_type="error",
                                  payload={"reason": "Provider unavailable"}))
        run_id = runs[0].id
        db.commit()
    failed = client.get(f"/api/agents/{agent['id']}").json()
    assert failed["status"] == "error"
    assert failed["versions"][-1]["status"] == "failed"
    trace = client.get(f"/api/evaluations/{evaluation}/tests/{run_id}").json()
    assert trace["status"] == "error"
    assert trace["test"]["executionError"] is True
    assert trace["test"]["explanation"] == "Provider unavailable"
