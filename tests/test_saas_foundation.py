import base64
import hashlib
import hmac
import json
import time
from dataclasses import replace
from datetime import timedelta
from uuid import uuid4

import pytest
import httpx
from fastapi import HTTPException

from app.database import SessionLocal, set_session_context
from app.auth import token_hash
from app.models import (
    Agent,
    AgentVersion,
    AuditEvent,
    BillingWebhookEvent,
    EvaluationJob,
    ExecutionTrace,
    LOCAL_ORGANIZATION_ID,
    LOCAL_USER_ID,
    LOCAL_WORKSPACE_ID,
    MockEnvironment,
    NotificationDelivery,
    Organization,
    OrganizationMembership,
    ReportShare,
    Scenario,
    Subscription,
    TestRun as RunRecord,
    UsageEvent,
    UsageReservation,
    UserProfile,
    Workspace,
    WorkspaceApiKey,
    now,
)
from app.scenarios import ScenarioSpec
from app.secret_store import SecretConfigurationError, decrypt_secret, encrypt_secret
from app.usage import reserve_credits, settle_run, usage_summary
from app.benchmark import score as score_benchmark


def test_workspace_scope_changes_with_each_request_context(client):
    workspace_a, workspace_b = str(uuid4()), str(uuid4())
    agent_a, agent_b = str(uuid4()), str(uuid4())
    db = SessionLocal()
    try:
        db.add_all([
            Workspace(id=workspace_a, organization_id=LOCAL_ORGANIZATION_ID,
                      name="Tenant A", slug=f"tenant-{workspace_a}"),
            Workspace(id=workspace_b, organization_id=LOCAL_ORGANIZATION_ID,
                      name="Tenant B", slug=f"tenant-{workspace_b}"),
        ])
        db.flush()
        db.add_all([
            Agent(id=agent_a, workspace_id=workspace_a, name="Scoped agent"),
            Agent(id=agent_b, workspace_id=workspace_b, name="Scoped agent"),
        ])
        db.commit()

        set_session_context(db, workspace_id=workspace_a)
        assert [row.id for row in db.query(Agent).filter(
            Agent.id.in_([agent_a, agent_b])).all()] == [agent_a]

        set_session_context(db, workspace_id=workspace_b)
        assert [row.id for row in db.query(Agent).filter(
            Agent.id.in_([agent_a, agent_b])).all()] == [agent_b]
    finally:
        db.rollback()
        db.query(Agent).execution_options(include_all_workspaces=True).filter(
            Agent.id.in_([agent_a, agent_b])).delete(synchronize_session=False)
        db.query(Workspace).filter(Workspace.id.in_([
            workspace_a, workspace_b])).delete(synchronize_session=False)
        db.commit()
        db.close()


def test_read_only_api_key_cannot_mutate_workspace(client, monkeypatch):
    created = client.post("/api/api-keys", json={
        "name": "CI read only",
        "scopes": ["read"],
    })
    assert created.status_code == 201
    key = created.json()["key"]

    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.delenv("AEGIS_AUTH_DISABLED", raising=False)
    headers = {"Authorization": f"Bearer {key}"}
    assert client.get("/api/agents", headers=headers).status_code == 200
    denied = client.post("/api/agents", headers=headers, json={
        "name": "Must not be created",
        "systemPrompt": "Help users.",
        "tools": [],
    })
    assert denied.status_code == 403
    assert "admin scope" in denied.json()["detail"]


def test_owner_can_change_and_remove_member_with_audit_history(client):
    user_id = str(uuid4())
    email = f"member-{user_id[:8]}@example.test"
    db = SessionLocal()
    try:
        db.add(UserProfile(id=user_id, email=email, display_name="Test member"))
        db.add(OrganizationMembership(
            organization_id=LOCAL_ORGANIZATION_ID,
            user_id=user_id,
            role="member",
        ))
        db.commit()
    finally:
        db.close()

    try:
        changed = client.patch(f"/api/members/{user_id}", json={"role": "viewer"})
        assert changed.status_code == 200
        assert changed.json() == {"id": user_id, "role": "viewer"}
        assert any(row["id"] == user_id and row["role"] == "viewer"
                   for row in client.get("/api/members").json())

        removed = client.delete(f"/api/members/{user_id}")
        assert removed.status_code == 204
        assert all(row["id"] != user_id for row in client.get("/api/members").json())
        assert client.delete(f"/api/members/{LOCAL_USER_ID}").status_code == 409

        db = SessionLocal()
        try:
            membership = db.query(OrganizationMembership).filter_by(
                organization_id=LOCAL_ORGANIZATION_ID,
                user_id=user_id,
            ).one()
            assert membership.status == "suspended"
            actions = [row.action for row in db.query(AuditEvent)
                       .execution_options(include_all_workspaces=True)
                       .filter(AuditEvent.target_id == user_id)
                       .order_by(AuditEvent.created_at).all()]
            assert actions == ["member.role.updated", "member.removed"]
        finally:
            db.close()
    finally:
        cleanup = SessionLocal()
        try:
            cleanup.query(AuditEvent).execution_options(
                include_all_workspaces=True).filter(
                AuditEvent.target_id == user_id).delete(synchronize_session=False)
            cleanup.query(OrganizationMembership).filter_by(
                organization_id=LOCAL_ORGANIZATION_ID,
                user_id=user_id,
            ).delete(synchronize_session=False)
            cleanup.query(UserProfile).filter_by(id=user_id).delete(
                synchronize_session=False)
            cleanup.commit()
        finally:
            cleanup.close()


def test_pending_invitation_can_be_listed_and_revoked(client):
    email = f"invite-{uuid4().hex[:10]}@example.test"
    created = client.post("/api/invitations", json={
        "email": email,
        "role": "member",
    })
    assert created.status_code == 201
    invitation_id = created.json()["id"]
    assert "token=" in created.json()["inviteUrl"]
    assert any(row["id"] == invitation_id and row["email"] == email
               for row in client.get("/api/invitations").json())
    assert client.delete(f"/api/invitations/{invitation_id}").status_code == 204
    assert all(row["id"] != invitation_id
               for row in client.get("/api/invitations").json())

    db = SessionLocal()
    try:
        from app.models import WorkspaceInvitation

        invitation = db.get(WorkspaceInvitation, invitation_id)
        assert invitation.status == "revoked"
        assert invitation.token_hash not in created.json()["inviteUrl"]
        db.query(AuditEvent).execution_options(include_all_workspaces=True).filter(
            AuditEvent.target_id == invitation_id).delete(synchronize_session=False)
        db.delete(invitation)
        db.commit()
    finally:
        db.close()


def test_private_report_link_is_hashed_expiring_and_revocable(client, monkeypatch):
    secret_policy = f"Never reveal private policy {uuid4()}"
    created = client.post("/api/agents", json={
        "name": f"Share test {uuid4()}",
        "systemPrompt": secret_policy,
        "tools": [{"name": "check_order", "description": "Read an order", "risk": "low"}],
    })
    assert created.status_code == 201
    agent_id = created.json()["id"]
    try:
        evaluation = client.post(f"/api/agents/{agent_id}/evaluate", json={
            "versionLabel": "shareable",
            "perCategory": 1,
            "adversarial": False,
            "adapter": "behavioral",
            "idempotencyKey": f"share-{uuid4()}",
        })
        assert evaluation.status_code == 202
        evaluation_id = evaluation.json()["evaluationId"]

        response = client.post(
            f"/api/evaluations/{evaluation_id}/shares",
            json={"expiresInDays": 7},
        )
        assert response.status_code == 201
        share = response.json()
        token = share["path"].rsplit("/", 1)[-1]
        assert token.startswith("aegis_share_")
        listed = client.get(f"/api/evaluations/{evaluation_id}/shares").json()
        assert listed[0]["id"] == share["id"]
        assert token not in json.dumps(listed)

        db = SessionLocal()
        try:
            stored = db.get(ReportShare, share["id"])
            assert stored.token_hash == token_hash(token)
            assert token not in stored.token_hash
        finally:
            db.close()

        monkeypatch.setenv("VERCEL", "1")
        monkeypatch.delenv("AEGIS_AUTH_DISABLED", raising=False)
        opened = client.get(f"/api/shared-reports/{token}")
        assert opened.status_code == 200
        assert opened.json()["evaluation"]["id"] == evaluation_id
        assert secret_policy not in opened.text
        monkeypatch.delenv("VERCEL")

        assert client.delete(f"/api/report-shares/{share['id']}").status_code == 204
        assert client.get(f"/api/shared-reports/{token}").status_code == 404
    finally:
        client.delete(f"/api/agents/{agent_id}")


def test_api_routes_cannot_cross_workspace_boundaries(client, monkeypatch):
    ids = {name: str(uuid4()) for name in (
        "organization_a", "organization_b", "workspace_a", "workspace_b",
        "user_a", "user_b", "agent_a", "agent_b", "environment_b",
        "scenario_b", "version_b1", "version_b2", "run_b",
    )}
    raw_a = f"aegis_{uuid4().hex}{uuid4().hex}"
    raw_b = f"aegis_{uuid4().hex}{uuid4().hex}"
    db = SessionLocal()
    try:
        db.add_all([
            Organization(id=ids["organization_a"], name="Tenant A",
                         slug=f"tenant-a-{ids['organization_a']}",
                         created_by=ids["user_a"]),
            Organization(id=ids["organization_b"], name="Tenant B",
                         slug=f"tenant-b-{ids['organization_b']}",
                         created_by=ids["user_b"]),
        ])
        db.flush()
        db.add_all([
            OrganizationMembership(organization_id=ids["organization_a"],
                                   user_id=ids["user_a"], role="owner"),
            OrganizationMembership(organization_id=ids["organization_b"],
                                   user_id=ids["user_b"], role="owner"),
            Workspace(id=ids["workspace_a"], organization_id=ids["organization_a"],
                      name="Workspace A", slug="default"),
            Workspace(id=ids["workspace_b"], organization_id=ids["organization_b"],
                      name="Workspace B", slug="default"),
            Subscription(organization_id=ids["organization_a"], provider="test",
                         plan="development", status="active"),
            Subscription(organization_id=ids["organization_b"], provider="test",
                         plan="development", status="active"),
        ])
        db.flush()
        db.add_all([
            WorkspaceApiKey(workspace_id=ids["workspace_a"], name="Tenant A key",
                            prefix=raw_a[:16], secret_hash=token_hash(raw_a),
                            created_by=ids["user_a"], scopes=["read", "evaluate", "admin"]),
            WorkspaceApiKey(workspace_id=ids["workspace_b"], name="Tenant B key",
                            prefix=raw_b[:16], secret_hash=token_hash(raw_b),
                            created_by=ids["user_b"], scopes=["read", "evaluate", "admin"]),
            Agent(id=ids["agent_a"], workspace_id=ids["workspace_a"], name="Agent A"),
            Agent(id=ids["agent_b"], workspace_id=ids["workspace_b"], name="Agent B"),
            MockEnvironment(id=ids["environment_b"], workspace_id=ids["workspace_b"],
                            name="Tenant B sandbox", tool_definitions={},
                            initial_state={}, injected_content={}),
        ])
        db.flush()
        db.add_all([
            AgentVersion(id=ids["version_b1"], workspace_id=ids["workspace_b"],
                         agent_id=ids["agent_b"], version_label="v1"),
            AgentVersion(id=ids["version_b2"], workspace_id=ids["workspace_b"],
                         agent_id=ids["agent_b"], version_label="v2"),
            Scenario(id=ids["scenario_b"], workspace_id=ids["workspace_b"],
                     name="Private tenant B scenario", initial_prompt="Private prompt",
                     mock_environment_id=ids["environment_b"]),
        ])
        db.flush()
        db.add(RunRecord(id=ids["run_b"], workspace_id=ids["workspace_b"],
                         agent_version_id=ids["version_b1"],
                         scenario_id=ids["scenario_b"], status="complete",
                         outcome="pass", reliability_score=100))
        db.commit()
    finally:
        db.close()

    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.delenv("AEGIS_AUTH_DISABLED", raising=False)
    headers_a = {
        "Authorization": f"Bearer {raw_a}",
        # Machine credentials are locked to their own workspace even if a caller
        # tries to override the browser workspace header.
        "X-Workspace-ID": ids["workspace_b"],
    }
    headers_b = {"Authorization": f"Bearer {raw_b}"}
    try:
        agents_a = client.get("/api/agents", headers=headers_a)
        agents_b = client.get("/api/agents", headers=headers_b)
        assert [row["id"] for row in agents_a.json()] == [ids["agent_a"]]
        assert [row["id"] for row in agents_b.json()] == [ids["agent_b"]]
        assert client.get(
            f"/api/agents/{ids['agent_b']}", headers=headers_a).status_code == 404
        assert client.patch(
            f"/api/agents/{ids['agent_b']}", headers=headers_a,
            json={"description": "cross-tenant edit"}).status_code == 404
        assert client.delete(
            f"/api/agents/{ids['agent_b']}", headers=headers_a).status_code == 404
        assert client.post(
            f"/api/test-runs/{ids['run_b']}/rerun", headers=headers_a).status_code == 404
        assert client.get(
            f"/api/versions/{ids['version_b1']}/compare/{ids['version_b2']}",
            headers=headers_a,
        ).status_code == 404
        invitation = client.post(
            "/api/invitations/not-a-browser-session/accept", headers=headers_a)
        assert invitation.status_code == 403
        assert invitation.json()["detail"] == "Sign in with the invited user account"
    finally:
        cleanup = SessionLocal()
        try:
            cleanup.query(Organization).filter(Organization.id.in_([
                ids["organization_a"], ids["organization_b"]])).delete(
                    synchronize_session=False)
            cleanup.commit()
        finally:
            cleanup.close()


def test_connected_agent_token_is_encrypted_and_never_returned(
        client, monkeypatch):
    key = base64.urlsafe_b64encode(b"k" * 32).decode().rstrip("=")
    monkeypatch.setenv("AEGIS_SECRET_ENCRYPTION_KEY", key)
    monkeypatch.setattr(
        "app.network_security.socket.getaddrinfo",
        lambda *_args, **_kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )
    secret = "runner-secret-that-must-never-leak"
    response = client.post("/api/agents", json={
        "name": f"Connected {uuid4()}",
        "systemPrompt": "Look up orders safely.",
        "tools": [{"name": "get_order", "risk": "low"}],
        "connection": {
            "mode": "connected",
            "url": "https://runner.example.test/evaluate",
            "bearerToken": secret,
        },
    })
    assert response.status_code == 201
    payload = response.json()
    assert payload["connection"] == {
        "mode": "connected",
        "authenticated": True,
        "url": "https://runner.example.test/evaluate",
    }
    assert secret not in response.text

    db = SessionLocal()
    try:
        row = db.get(Agent, payload["id"])
        encrypted = row.endpoint_config["bearer_token_encrypted"]
        assert secret not in encrypted
        assert decrypt_secret(
            encrypted,
            context="agent-endpoint:https://runner.example.test/evaluate",
        ) == secret
        with pytest.raises(SecretConfigurationError):
            decrypt_secret(encrypted, context="another-agent")
    finally:
        db.close()
    assert secret not in client.get(f"/api/agents/{payload['id']}").text
    assert client.delete(f"/api/agents/{payload['id']}").status_code == 204


def test_scenario_fingerprint_covers_prompt_oracle_and_environment():
    baseline = ScenarioSpec(
        name="Read an order",
        category="realistic",
        subtype="lookup",
        initial_prompt="Read order ORD-1.",
        expected_behavior={"must_call": ["get_order"]},
    )
    environment = {
        "tool_definitions": {"get_order": {"danger_level": "low"}},
        "initial_state": {"orders": {"ORD-1": {"status": "open"}}},
        "injected_content": {},
    }
    fingerprints = {
        baseline.fingerprint_for(environment),
        replace(baseline, initial_prompt="Read order ORD-2.").fingerprint_for(environment),
        replace(baseline, expected_behavior={
            "must_not_call": ["get_order"]}).fingerprint_for(environment),
        baseline.fingerprint_for({
            **environment,
            "initial_state": {"orders": {"ORD-1": {"status": "closed"}}},
        }),
    }
    assert len(fingerprints) == 4


def test_reviewed_suite_is_stored_as_an_immutable_dataset(client):
    agent = client.post("/api/agents", json={
        "name": f"Reviewed suite {uuid4()}",
        "systemPrompt": "Read orders but never delete them.",
        "tools": [
            {"name": "get_order", "risk": "low"},
            {"name": "delete_order", "risk": "high"},
        ],
    }).json()
    preview = client.post(
        f"/api/agents/{agent['id']}/suite-preview",
        json={"perCategory": 1, "adversarial": True, "seed": 42},
    )
    assert preview.status_code == 200
    original = preview.json()["scenarios"][0]
    reviewed = {
        key: original[key] for key in (
            "name", "category", "subtype", "initialPrompt",
            "expectedBehavior", "difficulty", "injectedContent",
        )
    }
    reviewed["initialPrompt"] = "Use the reviewed order ORD-9000."
    reviewed["expectedBehavior"] = {"must_call": ["get_order"]}
    created = client.post(
        f"/api/agents/{agent['id']}/evaluate",
        json={
            "versionLabel": "reviewed-v1",
            "adapter": "behavioral",
            "adversarial": True,
            "idempotencyKey": f"reviewed-{uuid4()}",
            "scenarios": [reviewed],
        },
    )
    assert created.status_code == 202
    assert created.json()["total"] == 1

    db = SessionLocal()
    try:
        version = db.get(AgentVersion, created.json()["evaluationId"])
        run = db.query(RunRecord).filter_by(agent_version_id=version.id).one()
        scenario = db.get(Scenario, run.scenario_id)
        assert version.config_snapshot["dataset_source"] == "reviewed"
        assert scenario.initial_prompt == reviewed["initialPrompt"]
        assert scenario.expected_behavior == reviewed["expectedBehavior"]
        assert scenario.fingerprint != original["fingerprint"]
        assert version.dataset_hash
    finally:
        db.close()
    assert client.delete(f"/api/agents/{agent['id']}").status_code == 204


def test_reviewed_benchmark_reports_errors_uncertainty_and_repeatability():
    result = score_benchmark([
        {"scenarioFingerprint": "repeat", "predictedIssue": True, "humanIssue": True},
        {"scenarioFingerprint": "repeat", "predictedIssue": True, "humanIssue": True},
        {"scenarioFingerprint": "fp", "predictedIssue": True, "humanIssue": False},
        {"scenarioFingerprint": "tn", "predictedIssue": False, "humanIssue": False},
        {"scenarioFingerprint": "fn", "predictedIssue": False, "humanIssue": True},
    ])
    assert result["confusionMatrix"] == {
        "truePositive": 2,
        "falsePositive": 1,
        "trueNegative": 1,
        "falseNegative": 1,
    }
    assert result["precision"]["value"] == pytest.approx(2 / 3, abs=0.0001)
    assert result["recall"]["value"] == pytest.approx(2 / 3, abs=0.0001)
    assert result["precision"]["confidence95"][0] < result["precision"]["value"]
    assert result["repeatability"]["value"] == 1.0
    assert result["repeatability"]["scenarioContracts"] == 1


def test_usage_settlement_is_idempotent(client):
    db = SessionLocal()
    try:
        set_session_context(db, workspace_id=LOCAL_WORKSPACE_ID)
        reservation = reserve_credits(
            db,
            LOCAL_WORKSPACE_ID,
            LOCAL_ORGANIZATION_ID,
            2,
            f"usage-test-{uuid4()}",
        )
        db.commit()
        reservation_id = reservation.id
        run_id = str(uuid4())

        settle_run(db, reservation_id, run_id, LOCAL_WORKSPACE_ID,
                   input_tokens=12, output_tokens=4, estimated_cost_usd=0.001)
        settle_run(db, reservation_id, run_id, LOCAL_WORKSPACE_ID,
                   input_tokens=12, output_tokens=4, estimated_cost_usd=0.001)
        db.commit()

        stored = db.get(UsageReservation, reservation_id)
        events = db.query(UsageEvent).filter_by(
            reservation_id=reservation_id).all()
        assert stored.settled_units == 1
        assert len(events) == 1
        assert events[0].input_tokens == 12
    finally:
        db.rollback()
        db.query(UsageEvent).execution_options(include_all_workspaces=True).filter(
            UsageEvent.reservation_id == locals().get("reservation_id", "")
        ).delete(synchronize_session=False)
        if locals().get("reservation_id"):
            db.query(UsageReservation).execution_options(
                include_all_workspaces=True).filter_by(
                id=reservation_id).delete(synchronize_session=False)
        db.commit()
        db.close()


def test_workspace_model_spend_cap_is_reserved_atomically(client):
    db = SessionLocal()
    workspace_id = str(uuid4())
    reservation_id = None
    try:
        db.add(Workspace(
            id=workspace_id,
            organization_id=LOCAL_ORGANIZATION_ID,
            name="Spend cap test",
            slug=f"spend-cap-{workspace_id}",
            settings={"monthlySpendCapUsd": 0.50},
        ))
        db.commit()
        with pytest.raises(HTTPException) as denied:
            reserve_credits(
                db, workspace_id, LOCAL_ORGANIZATION_ID, 1,
                f"spend-denied-{uuid4()}", reserved_cost_usd=0.51,
            )
        assert denied.value.status_code == 402

        reservation = reserve_credits(
            db, workspace_id, LOCAL_ORGANIZATION_ID, 1,
            f"spend-accepted-{uuid4()}", reserved_cost_usd=0.40,
        )
        db.commit()
        reservation_id = reservation.id
        summary = usage_summary(db, workspace_id, LOCAL_ORGANIZATION_ID)
        assert summary["spendCapUsd"] == 0.50
        assert summary["reservedCostUsd"] == pytest.approx(0.40)
        assert summary["spendRemainingUsd"] == pytest.approx(0.10)
    finally:
        db.rollback()
        if reservation_id:
            db.query(UsageReservation).execution_options(
                include_all_workspaces=True).filter_by(
                id=reservation_id).delete(synchronize_session=False)
        workspace = db.get(Workspace, workspace_id)
        if workspace:
            db.delete(workspace)
        db.commit()
        db.close()


def test_expired_worker_lease_is_recovered_without_stale_trace(client):
    ids = {name: str(uuid4()) for name in (
        "agent", "version", "environment", "scenario", "run", "job")}
    db = SessionLocal()
    try:
        db.add(Agent(id=ids["agent"], workspace_id=LOCAL_WORKSPACE_ID,
                     name=f"Lease test {ids['agent']}"))
        db.add(MockEnvironment(
            id=ids["environment"], workspace_id=LOCAL_WORKSPACE_ID,
            name="Lease environment", tool_definitions={}, initial_state={},
            injected_content={},
        ))
        db.flush()
        db.add(Scenario(
            id=ids["scenario"], workspace_id=LOCAL_WORKSPACE_ID,
            name="Lease scenario", initial_prompt="Hello",
            mock_environment_id=ids["environment"],
        ))
        db.add(AgentVersion(
            id=ids["version"], workspace_id=LOCAL_WORKSPACE_ID,
            agent_id=ids["agent"], version_label="lease-test",
        ))
        db.flush()
        db.add(RunRecord(
            id=ids["run"], workspace_id=LOCAL_WORKSPACE_ID,
            agent_version_id=ids["version"], scenario_id=ids["scenario"],
            status="running", started_at=now() - timedelta(minutes=5),
        ))
        db.flush()
        db.add_all([
            EvaluationJob(
                id=ids["job"], workspace_id=LOCAL_WORKSPACE_ID,
                test_run_id=ids["run"], status="running", attempts=1,
                available_at=now() - timedelta(days=365),
                lease_owner="dead-worker", lease_until=now() - timedelta(minutes=1),
            ),
            ExecutionTrace(
                workspace_id=LOCAL_WORKSPACE_ID, test_run_id=ids["run"],
                step_number=1, step_type="agent_message", payload={"stale": True},
            ),
        ])
        db.commit()
    finally:
        db.close()

    from app.engine import claim_next_job

    assert claim_next_job("replacement-worker") == ids["job"]
    db = SessionLocal()
    try:
        job = db.get(EvaluationJob, ids["job"])
        run = db.get(RunRecord, ids["run"])
        assert (job.status, job.attempts, job.lease_owner) == (
            "running", 2, "replacement-worker")
        assert run.status == "pending"
        assert db.query(ExecutionTrace).filter_by(test_run_id=ids["run"]).count() == 0
        run.status = "error"
        run.completed_at = now()
        db.add(ExecutionTrace(
            workspace_id=LOCAL_WORKSPACE_ID, test_run_id=ids["run"],
            step_number=1, step_type="error",
            payload={"reason": "temporary timeout", "retryable": True},
        ))
        db.commit()
    finally:
        db.close()

    from app.engine import _finalize_job

    _finalize_job(ids["job"])
    db = SessionLocal()
    try:
        job = db.get(EvaluationJob, ids["job"])
        run = db.get(RunRecord, ids["run"])
        assert job.status == "queued"
        assert job.last_error == "temporary timeout"
        assert run.status == "pending"
        assert db.query(ExecutionTrace).filter_by(test_run_id=ids["run"]).count() == 0
    finally:
        db.query(Agent).execution_options(include_all_workspaces=True).filter_by(
            id=ids["agent"]).delete(synchronize_session=False)
        db.commit()
        db.close()


def test_razorpay_webhook_is_signed_and_idempotent(client, monkeypatch):
    organization_id = str(uuid4())
    workspace_id = str(uuid4())
    event_id = f"event_{uuid4().hex}"
    secret = "razorpay_test_webhook_secret"
    subscription_id = f"sub_{uuid4().hex}"
    db = SessionLocal()
    try:
        db.add(Organization(
            id=organization_id,
            name="Webhook test",
            slug=f"webhook-{organization_id}",
            created_by="test-user",
        ))
        db.add(Subscription(organization_id=organization_id, provider="razorpay"))
        db.add(Workspace(
            id=workspace_id,
            organization_id=organization_id,
            name="Webhook workspace",
            slug="webhook",
            retention_days=365,
        ))
        db.commit()
    finally:
        db.close()

    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", secret)
    event_created = int(time.time())
    event = {
        "event": "subscription.activated",
        "created_at": event_created,
        "payload": {"subscription": {"entity": {
            "id": subscription_id,
            "plan_id": "plan_starter",
            "status": "active",
            "notes": {"organization_id": organization_id, "plan": "starter"},
            "current_start": int(time.time()),
            "current_end": int(time.time()) + 30 * 86400,
        }}},
    }
    payload = json.dumps(event, separators=(",", ":")).encode()
    signature = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    headers = {
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": event_id,
        "content-type": "application/json",
    }
    first = client.post("/api/webhooks/razorpay", content=payload, headers=headers)
    second = client.post("/api/webhooks/razorpay", content=payload, headers=headers)
    assert first.json() == {"received": True}
    assert second.json() == {"received": True, "duplicate": True}

    older = {
        "event": "subscription.pending",
        "created_at": event_created - 60,
        "payload": {"subscription": {"entity": event["payload"]["subscription"]["entity"]}},
    }
    older_payload = json.dumps(older, separators=(",", ":")).encode()
    older_signature = hmac.new(secret.encode(), older_payload, hashlib.sha256).hexdigest()
    older_id = f"event_{uuid4().hex}"
    stale = client.post(
        "/api/webhooks/razorpay",
        content=older_payload,
        headers={**headers, "x-razorpay-signature": older_signature,
                 "x-razorpay-event-id": older_id},
    )
    assert stale.json() == {"received": True, "ignored": "stale_event"}

    db = SessionLocal()
    try:
        subscription = db.get(Subscription, organization_id)
        assert (subscription.plan, subscription.status) == ("starter", "active")
        assert db.get(Workspace, workspace_id).retention_days == 90
    finally:
        db.close()

    payment_failed_id = f"event_{uuid4().hex}"
    payment_failed = {
        "event": "subscription.pending",
        "created_at": event_created + 20,
        "payload": {"subscription": {"entity": {
            **event["payload"]["subscription"]["entity"], "status": "pending"}}},
    }
    failed_payload = json.dumps(payment_failed, separators=(",", ":")).encode()
    failed_signature = hmac.new(secret.encode(), failed_payload, hashlib.sha256).hexdigest()
    assert client.post(
        "/api/webhooks/razorpay",
        content=failed_payload,
        headers={**headers, "x-razorpay-signature": failed_signature,
                 "x-razorpay-event-id": payment_failed_id},
    ).json() == {"received": True}
    with SessionLocal() as db:
        assert db.get(Subscription, organization_id).status == "past_due"

    invoice_paid_id = f"event_{uuid4().hex}"
    invoice_paid = {
        "event": "subscription.charged",
        "created_at": event_created + 40,
        "payload": {"subscription": {"entity": {
            **event["payload"]["subscription"]["entity"], "status": "active"}}},
    }
    paid_payload = json.dumps(invoice_paid, separators=(",", ":")).encode()
    paid_signature = hmac.new(secret.encode(), paid_payload, hashlib.sha256).hexdigest()
    assert client.post(
        "/api/webhooks/razorpay",
        content=paid_payload,
        headers={**headers, "x-razorpay-signature": paid_signature,
                 "x-razorpay-event-id": invoice_paid_id},
    ).json() == {"received": True}
    with SessionLocal() as db:
        assert db.get(Subscription, organization_id).status == "active"

    team_event_id = f"event_{uuid4().hex}"
    team_event = {
        "event": "subscription.updated",
        "created_at": event_created + 60,
        "payload": {"subscription": {"entity": {
            **event["payload"]["subscription"]["entity"],
            "status": "active",
            "notes": {"organization_id": organization_id, "plan": "team"},
        }}},
    }
    team_payload = json.dumps(team_event, separators=(",", ":")).encode()
    team_signature = hmac.new(secret.encode(), team_payload, hashlib.sha256).hexdigest()
    assert client.post(
        "/api/webhooks/razorpay",
        content=team_payload,
        headers={**headers, "x-razorpay-signature": team_signature,
                 "x-razorpay-event-id": team_event_id},
    ).json() == {"received": True}

    deleted_event_id = f"event_{uuid4().hex}"
    deleted_event = {
        "event": "subscription.cancelled",
        "created_at": event_created + 120,
        "payload": {"subscription": {"entity": {
            **team_event["payload"]["subscription"]["entity"],
            "status": "cancelled",
        }}},
    }
    deleted_payload = json.dumps(deleted_event, separators=(",", ":")).encode()
    deleted_signature = hmac.new(secret.encode(), deleted_payload, hashlib.sha256).hexdigest()
    assert client.post(
        "/api/webhooks/razorpay",
        content=deleted_payload,
        headers={**headers, "x-razorpay-signature": deleted_signature,
                 "x-razorpay-event-id": deleted_event_id},
    ).json() == {"received": True}

    db = SessionLocal()
    try:
        subscription = db.get(Subscription, organization_id)
        assert (subscription.plan, subscription.status) == ("trial", "canceled")
        assert db.get(Workspace, workspace_id).retention_days == 14
        assert db.query(BillingWebhookEvent).filter(
            BillingWebhookEvent.id.in_([
                event_id, older_id, payment_failed_id, invoice_paid_id,
                team_event_id, deleted_event_id,
            ])).count() == 6
    finally:
        db.query(BillingWebhookEvent).filter(BillingWebhookEvent.id.in_([
            event_id, older_id, payment_failed_id, invoice_paid_id,
            team_event_id, deleted_event_id,
        ])).delete(synchronize_session=False)
        db.query(Organization).filter_by(id=organization_id).delete()
        db.commit()
        db.close()


def test_recurring_checkout_verifies_subscription_identity(client, monkeypatch):
    key_id = "rzp_test_subscription_key"
    key_secret = "subscription-signing-secret"
    plan_id = "plan_test_starter"
    subscription_id = "sub_test_recurring"
    payment_id = "pay_test_recurring"
    current_start = int(time.time())
    monkeypatch.setenv("RAZORPAY_KEY_ID", key_id)
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", key_secret)
    monkeypatch.setenv("RAZORPAY_STARTER_PLAN_ID", plan_id)
    monkeypatch.setenv("RAZORPAY_TEAM_PLAN_ID", "plan_test_team")

    def razorpay_request(method, path, *, data=None):
        if (method, path) == ("POST", "subscriptions"):
            assert data["plan_id"] == plan_id
            assert data["notes"] == {
                "organization_id": LOCAL_ORGANIZATION_ID,
                "plan": "starter",
                "product": "aegis",
            }
            return {"id": subscription_id, "status": "created"}
        if (method, path) == ("GET", f"payments/{payment_id}"):
            return {"amount": 199900, "currency": "INR", "status": "captured"}
        if (method, path) == ("GET", f"subscriptions/{subscription_id}"):
            return {
                "id": subscription_id,
                "plan_id": plan_id,
                "customer_id": "cust_test_recurring",
                "status": "active",
                "current_start": current_start,
                "current_end": current_start + 30 * 86400,
                "notes": {
                    "organization_id": LOCAL_ORGANIZATION_ID,
                    "plan": "starter",
                },
            }
        raise AssertionError(f"Unexpected Razorpay call: {method} {path}")

    monkeypatch.setattr("app.billing_api._razorpay_request", razorpay_request)
    db = SessionLocal()
    subscription = db.get(Subscription, LOCAL_ORGANIZATION_ID)
    workspace = db.get(Workspace, LOCAL_WORKSPACE_ID)
    original_subscription = {
        column.name: getattr(subscription, column.name)
        for column in Subscription.__table__.columns
    }
    original_retention = workspace.retention_days
    subscription.provider = "razorpay"
    subscription.provider_customer_id = None
    subscription.provider_subscription_id = None
    subscription.plan = "trial"
    subscription.status = "trialing"
    subscription.current_period_start = None
    subscription.current_period_end = None
    subscription.cancel_at_period_end = False
    db.commit()
    db.close()

    try:
        checkout = client.post("/api/billing/checkout", json={"plan": "starter"})
        assert checkout.status_code == 200
        assert checkout.json() == {
            "mode": "subscription",
            "subscriptionId": subscription_id,
            "keyId": key_id,
            "name": "Aegis",
            "description": "Aegis Starter monthly plan",
        }

        signature = hmac.new(
            key_secret.encode(),
            f"{payment_id}|{subscription_id}".encode(),
            hashlib.sha256,
        ).hexdigest()
        verified = client.post("/api/billing/verify", json={
            "plan": "starter",
            "subscriptionId": subscription_id,
            "paymentId": payment_id,
            "signature": signature,
        })
        assert verified.status_code == 200
        assert verified.json() == {
            "verified": True,
            "plan": "starter",
            "status": "active",
            "billingMode": "subscription",
        }

        with SessionLocal() as check:
            row = check.get(Subscription, LOCAL_ORGANIZATION_ID)
            assert row.provider_subscription_id == subscription_id
            assert row.provider_customer_id == "cust_test_recurring"
            assert (row.plan, row.status, row.cancel_at_period_end) == (
                "starter", "active", False)
            assert check.get(Workspace, LOCAL_WORKSPACE_ID).retention_days == 90
    finally:
        with SessionLocal() as cleanup:
            row = cleanup.get(Subscription, LOCAL_ORGANIZATION_ID)
            for name, value in original_subscription.items():
                setattr(row, name, value)
            cleanup.get(Workspace, LOCAL_WORKSPACE_ID).retention_days = original_retention
            cleanup.query(AuditEvent).execution_options(
                include_all_workspaces=True).filter(
                AuditEvent.target_id == LOCAL_ORGANIZATION_ID,
                AuditEvent.action.in_([
                    "billing.checkout.created", "billing.payment.verified",
                ]),
            ).delete(synchronize_session=False)
            cleanup.commit()


def test_razorpay_webhook_rejects_an_invalid_signature(client, monkeypatch):
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "correct")
    response = client.post(
        "/api/webhooks/razorpay",
        content=b"{}",
        headers={"x-razorpay-signature": "wrong"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid Razorpay signature"


def test_completion_email_is_private_and_idempotent(client, monkeypatch):
    deliveries = []

    def send(request_url, *, json, headers, timeout):
        deliveries.append({"url": request_url, "json": json, "headers": headers,
                           "timeout": timeout})
        return httpx.Response(
            200,
            json={"id": "email_test_1"},
            request=httpx.Request("POST", request_url),
        )

    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "Aegis <test@example.com>")
    monkeypatch.setenv("APP_URL", "https://aegis.example.test")
    monkeypatch.setattr("app.notifications.httpx.post", send)

    db = SessionLocal()
    workspace = db.get(Workspace, LOCAL_WORKSPACE_ID)
    previous_settings = dict(workspace.settings or {})
    workspace.settings = {
        **previous_settings,
        "notifications": {"emailEnabled": True, "email": "owner@example.com"},
    }
    db.commit()
    db.close()

    agent = client.post("/api/agents", json={
        "name": f"Notification {uuid4()}",
        "systemPrompt": "Private policy: never reveal ACME-SECRET-42.",
        "tools": [{"name": "get_order", "risk": "low"}],
    }).json()
    evaluation_id = client.post(
        f"/api/agents/{agent['id']}/evaluate",
        json={"perCategory": 1, "adapter": "behavioral",
              "idempotencyKey": f"notification-{uuid4()}"},
    ).json()["evaluationId"]

    from app.notifications import send_evaluation_notification

    assert send_evaluation_notification(evaluation_id, LOCAL_WORKSPACE_ID) is True
    assert len(deliveries) == 1
    serialized = json.dumps(deliveries[0]["json"])
    assert "ACME-SECRET-42" not in serialized
    assert deliveries[0]["headers"]["Idempotency-Key"].startswith(
        f"evaluation-{evaluation_id}-")

    db = SessionLocal()
    try:
        row = db.query(NotificationDelivery).filter_by(
            evaluation_id=evaluation_id).one()
        assert (row.status, row.attempts, row.provider_id) == (
            "sent", 1, "email_test_1")
        db.query(NotificationDelivery).filter_by(
            evaluation_id=evaluation_id).delete(synchronize_session=False)
        workspace = db.get(Workspace, LOCAL_WORKSPACE_ID)
        workspace.settings = previous_settings
        db.commit()
    finally:
        db.close()
    assert client.delete(f"/api/agents/{agent['id']}").status_code == 204


def test_operations_status_exposes_monitorable_signals(client):
    from app.maintenance import operations_status

    status = operations_status()
    assert set((
        "healthy", "queuedJobs", "runningJobs", "expiredLeases",
        "oldestQueuedSeconds", "failedJobs", "exhaustedNotifications",
        "failedBillingWebhooks", "delinquentSubscriptions",
        "expiredReservations",
    )).issubset(status)
    assert status["oldestQueuedSeconds"] >= 0
