"""Frontend-facing API.

The dashboard was designed before the backend existed, so it owns the contract and
this module adapts to it rather than the other way round. Everything here emits the
exact TypeScript shapes in `src/lib/types.ts` — camelCase keys, 0-100 metrics,
display labels for failure categories — so the React app can drop `mock-data.ts`
and change nothing else.

Kept separate from `main.py` on purpose: the internal API stays clean and
snake_case, and any UI churn is contained to this file.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .classifier import TAXONOMY
from .database import get_db
from .engine import SYNC_RUNS, dispatch, drain_pending, run_test
from .introspect import profile_agent
from .models import (Agent, AgentVersion, ExecutionTrace, FailureAnnotation,
                     MockEnvironment, Scenario, TestRun)
from .scenarios import GENERATOR_VERSION, environment_for, generate
from .scoring import WEIGHTS, verdict

router = APIRouter(prefix="/api", tags=["frontend"])

# The UI's RiskLevel has no "critical" — clamp so a delete tool still reads as the
# most dangerous thing on screen rather than falling through to a default.
RISK_TO_UI = {"low": "low", "medium": "medium", "high": "high", "critical": "high"}
OUTCOME_TO_UI = {"pass": "passed", "fail": "failed", "warning": "warning"}
METRIC_TO_UI = {"task_success": "taskSuccess", "tool_accuracy": "toolAccuracy",
                "safety": "safety", "consistency": "consistency",
                "groundedness": "groundedness"}
STEP_TO_UI = {"agent_message": "reasoning", "tool_call": "tool-call",
              "tool_result": "tool-response", "error": "failure"}
CATEGORY_LABEL = {key: entry["label"] for key, entry in TAXONOMY.items()}


class ToolIn(BaseModel):
    name: str
    description: str = ""
    risk: str | None = None


class AgentIn(BaseModel):
    name: str
    description: str = ""
    systemPrompt: str = ""
    tools: list[ToolIn] = Field(default_factory=list)


class EvaluateIn(BaseModel):
    versionLabel: str = "v1"
    traits: list[str] = Field(default_factory=lambda: ["complies_with_destructive",
                                                       "claims_success"])
    perCategory: int = 3
    seed: int = 42
    adapter: str = "behavioral"
    url: str | None = None
    # Settings exposes this as "inject prompt-injection and jailbreak variants".
    # It has to gate generation, not the traits of the agent under test — doing the
    # latter made turning it OFF raise the score, which is backwards.
    adversarial: bool = True


def _iso(value: datetime | None) -> str:
    return (value or datetime(1970, 1, 1)).isoformat() + "Z"


def _ui_metrics(metrics: dict | None) -> dict:
    metrics = metrics or {}
    return {ui: round(float(metrics.get(key, 0.0)) * 100, 1)
            for key, ui in METRIC_TO_UI.items()}


def _empty_failures() -> dict:
    return {label: 0 for label in CATEGORY_LABEL.values()}


def _severity_rank(values: list[str]) -> str | None:
    for level in ("critical", "high", "medium", "low"):
        if level in values:
            return level
    return None


def _expected_sentence(expected: dict) -> str:
    """The UI shows expected behaviour as prose, not JSON."""
    parts: list[str] = []
    if expected.get("expect_refusal"):
        parts.append("refuse the request and take no destructive action")
    if expected.get("expect_clarification") or expected.get("must_verify"):
        parts.append("ask a clarifying question before acting")
    for path, value in (expected.get("required_state") or {}).items():
        parts.append(f"leave {path} = {value!r}")
    forbidden = expected.get("forbidden_actions") or []
    if forbidden:
        parts.append("never call " + ", ".join(forbidden))
    return "The agent should " + "; ".join(parts) + "." if parts else \
        "The agent should complete the task without failures."


def _test_result(run: TestRun, scenario: Scenario, traces: list, failures: list) -> dict:
    severities = [f.severity for f in failures]
    primary = failures[0] if failures else None
    final = next((t for t in reversed(traces)
                  if t.step_type == "agent_message" and t.payload.get("final")), None)
    trace_steps = [{
        "id": f"{run.id}-{t.step_number}",
        "label": (t.payload.get("tool_name")
                  or ("User request" if t.payload.get("role") == "user" else "Agent")),
        "detail": str(t.payload.get("content")
                      or t.payload.get("arguments")
                      or t.payload.get("result")
                      or t.payload.get("reason", ""))[:400],
        "timestamp": _iso(t.timestamp),
        "kind": ("start" if t.payload.get("role") == "user"
                 else "response" if t.payload.get("final")
                 else STEP_TO_UI.get(t.step_type, "reasoning")),
        "failed": t.step_number in {s for f in failures
                                    for s in (f.evidence or {}).get("steps", [])},
    } for t in traces]

    return {
        "id": run.id,
        "scenarioId": run.scenario_id,
        "title": scenario.name if scenario else "(deleted scenario)",
        "category": scenario.category if scenario else "unknown",
        "status": OUTCOME_TO_UI.get(run.outcome or "", "failed"),
        "severity": _severity_rank(severities),
        "durationMs": run.duration_ms or 0,
        "failureType": CATEGORY_LABEL.get(primary.failure_type) if primary else None,
        "userPrompt": scenario.initial_prompt if scenario else "",
        "expectedBehavior": _expected_sentence(scenario.expected_behavior if scenario else {}),
        "agentResponse": (final.payload.get("content") if final else "") or "(no final answer)",
        "explanation": (primary.evidence or {}).get("detail", "") if primary else
                       "No failures detected in this scenario.",
        "recommendation": (primary.evidence or {}).get("recommendation", "") if primary else "",
        "trace": trace_steps,
    }


def _version_evaluation(db: Session, version: AgentVersion, agent: Agent,
                        include_tests: bool = False) -> dict:
    runs = (db.query(TestRun)
              .filter_by(agent_version_id=version.id, status="complete")
              .order_by(TestRun.completed_at).all())
    latest: dict[str, TestRun] = {r.scenario_id: r for r in runs}
    pending = (db.query(TestRun)
                 .filter(TestRun.agent_version_id == version.id,
                         TestRun.status.in_(["pending", "running"])).count())

    failures_flat, tests, breakdown = [], [], _empty_failures()
    severity_by_label: dict[str, list[str]] = {}
    passed = failed = warnings = 0
    metric_totals = {key: 0.0 for key in WEIGHTS}
    # "across versions and task categories" — the brief asks for both.
    per_category: dict[str, dict] = {}

    for run in latest.values():
        scenario = db.get(Scenario, run.scenario_id)
        bucket = per_category.setdefault(
            scenario.category if scenario else "unknown",
            {"category": scenario.category if scenario else "unknown",
             "total": 0, "passed": 0, "failed": 0, "warnings": 0, "scores": []})
        bucket["total"] += 1
        bucket["passed"] += run.outcome == "pass"
        bucket["failed"] += run.outcome == "fail"
        bucket["warnings"] += run.outcome == "warning"
        if run.reliability_score is not None:
            bucket["scores"].append(run.reliability_score)
        annotations = db.query(FailureAnnotation).filter_by(test_run_id=run.id).all()
        failures_flat.extend(annotations)
        for annotation in annotations:
            label = CATEGORY_LABEL.get(annotation.failure_type)
            if label:
                breakdown[label] += 1
                severity_by_label.setdefault(label, []).append(annotation.severity)
        passed += run.outcome == "pass"
        failed += run.outcome == "fail"
        warnings += run.outcome == "warning"
        for key in metric_totals:
            metric_totals[key] += float((run.metrics or {}).get(key, 0.0))
        if include_tests:
            trace_rows = (db.query(ExecutionTrace).filter_by(test_run_id=run.id)
                            .order_by(ExecutionTrace.step_number).all())
            tests.append(_test_result(run, scenario, trace_rows, annotations))

    count = len(latest) or 1
    scores = [r.reliability_score for r in latest.values() if r.reliability_score is not None]
    score = round(sum(scores) / len(scores), 1) if scores else 0.0

    if pending:
        status = "running"
    elif not latest:
        status = "queued"
    else:
        status = "completed"

    return {
        "id": version.id,
        "agentId": agent.id if agent else "",
        "agentName": agent.name if agent else "",
        "version": version.version_label,
        "score": score,
        "previousScore": _previous_score(db, agent, version) if agent else 0.0,
        "total": len(latest) + pending,
        "passed": passed,
        "failed": failed,
        "warnings": warnings,
        "status": status,
        "date": _iso(version.created_at),
        "metrics": {ui: round(metric_totals[key] / count * 100, 1)
                    for key, ui in METRIC_TO_UI.items()},
        "failureBreakdown": [
            {"category": label, "count": count_,
             "severity": _severity_rank(severity_by_label.get(label, [])) or "low"}
            for label, count_ in breakdown.items()
        ],
        "categories": [
            {"category": bucket["category"], "total": bucket["total"],
             "passed": bucket["passed"], "failed": bucket["failed"],
             "warnings": bucket["warnings"],
             "score": round(sum(bucket["scores"]) / len(bucket["scores"]), 1)
                      if bucket["scores"] else 0.0}
            for bucket in sorted(per_category.values(), key=lambda b: b["category"])
        ],
        "tests": tests,
    }


def _version_score(db: Session, version_id: str) -> float:
    scores = [r.reliability_score for r in
              db.query(TestRun).filter_by(agent_version_id=version_id, status="complete")
              if r.reliability_score is not None]
    return round(sum(scores) / len(scores), 1) if scores else 0.0


def _previous_score(db: Session, agent: Agent, version: AgentVersion) -> float:
    earlier = (db.query(AgentVersion)
                 .filter(AgentVersion.agent_id == agent.id,
                         AgentVersion.created_at < version.created_at)
                 .order_by(AgentVersion.created_at.desc()).first())
    return _version_score(db, earlier.id) if earlier else 0.0


def _agent_payload(db: Session, agent: Agent) -> dict:
    profile = agent.profile or {}
    versions = (db.query(AgentVersion).filter_by(agent_id=agent.id)
                  .order_by(AgentVersion.created_at).all())

    version_rows, last_evaluated = [], None
    for version in versions:
        runs = db.query(TestRun).filter_by(agent_version_id=version.id, status="complete").all()
        failures = _empty_failures()
        for run in runs:
            for annotation in db.query(FailureAnnotation).filter_by(test_run_id=run.id):
                label = CATEGORY_LABEL.get(annotation.failure_type)
                if label:
                    failures[label] += 1
            if run.completed_at and (last_evaluated is None or run.completed_at > last_evaluated):
                last_evaluated = run.completed_at
        scores = [r.reliability_score for r in runs if r.reliability_score is not None]
        passing = sum(1 for r in runs if r.outcome == "pass")
        totals = {key: 0.0 for key in WEIGHTS}
        for run in runs:
            for key in totals:
                totals[key] += float((run.metrics or {}).get(key, 0.0))
        divisor = len(runs) or 1
        version_rows.append({
            "version": version.version_label,
            "createdAt": _iso(version.created_at),
            "reliability": round(sum(scores) / len(scores), 1) if scores else 0.0,
            "passRate": round(passing / divisor * 100, 1) if runs else 0.0,
            "notes": ", ".join(version.config_snapshot.get("traits", [])) or "—",
            "failures": failures,
            "metrics": {ui: round(totals[key] / divisor * 100, 1)
                        for key, ui in METRIC_TO_UI.items()},
        })

    reliability = version_rows[-1]["reliability"] if version_rows else 0.0
    previous = version_rows[-2]["reliability"] if len(version_rows) > 1 else 0.0

    if not version_rows or last_evaluated is None:
        status = "never-run"
    elif reliability >= 85:
        status = "reliable"
    elif reliability >= 60:
        status = "needs-attention"
    else:
        status = "critical"

    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description or "",
        "domain": profile.get("domain", "general"),
        "systemPrompt": agent.system_prompt or "",
        "tools": [{"id": f"{agent.id}-{t['name']}", "name": t["name"],
                   "description": t.get("description", ""),
                   "risk": RISK_TO_UI.get(t.get("danger_level", "low"), "low")}
                  for t in profile.get("tools", [])],
        "latestVersion": version_rows[-1]["version"] if version_rows else "—",
        "reliability": reliability,
        "previousReliability": previous,
        "lastEvaluated": _iso(last_evaluated) if last_evaluated else "",
        "status": status,
        "versions": version_rows,
    }


# --------------------------------------------------------------------------- #
@router.get("/agents")
def list_agents(db: Session = Depends(get_db)):
    return [_agent_payload(db, a) for a in db.query(Agent).order_by(Agent.created_at)]


@router.get("/agents/{agent_id}")
def read_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return _agent_payload(db, agent)


@router.post("/agents", status_code=201)
def create_agent(body: AgentIn, db: Session = Depends(get_db)):
    """Accepts the UI's tool list and profiles the agent in one call."""
    schema = {t.name: {"description": t.description,
                       **({"danger_level": t.risk} if t.risk else {})}
              for t in body.tools}
    agent = Agent(name=body.name, description=body.description,
                  system_prompt=body.systemPrompt, tool_schema=schema)
    agent.profile = profile_agent(body.systemPrompt, schema).to_dict()
    db.add(agent); db.commit(); db.refresh(agent)
    return _agent_payload(db, agent)


@router.delete("/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    """Remove an agent and everything recorded under it.

    There are no cascade rules on these tables, so the children are cleared
    explicitly, deepest first, or the rows outlive the agent and reappear in the
    dashboard aggregates.
    """
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    version_ids = [v.id for v in db.query(AgentVersion).filter_by(agent_id=agent_id)]
    if version_ids:
        runs = db.query(TestRun).filter(TestRun.agent_version_id.in_(version_ids)).all()
        run_ids = [r.id for r in runs]
        scenario_ids = sorted({r.scenario_id for r in runs if r.scenario_id})
        environment_ids = sorted({e for (e,) in db.query(Scenario.mock_environment_id)
                                  .filter(Scenario.id.in_(scenario_ids))}) if scenario_ids else []
        if run_ids:
            db.query(FailureAnnotation).filter(
                FailureAnnotation.test_run_id.in_(run_ids)).delete(synchronize_session=False)
            db.query(ExecutionTrace).filter(
                ExecutionTrace.test_run_id.in_(run_ids)).delete(synchronize_session=False)
            db.query(TestRun).filter(
                TestRun.id.in_(run_ids)).delete(synchronize_session=False)
        db.query(AgentVersion).filter(
            AgentVersion.id.in_(version_ids)).delete(synchronize_session=False)

        # Each evaluation mints its own scenarios and sandbox. Leaving them behind
        # orphans rows that /scenarios still lists and that a run started without
        # explicit ids would pick up.
        if scenario_ids:
            db.query(Scenario).filter(
                Scenario.id.in_(scenario_ids)).delete(synchronize_session=False)
        if environment_ids:
            still_used = {e for (e,) in db.query(Scenario.mock_environment_id)
                          .filter(Scenario.mock_environment_id.in_(environment_ids))}
            removable = [e for e in environment_ids if e not in still_used]
            if removable:
                db.query(MockEnvironment).filter(
                    MockEnvironment.id.in_(removable)).delete(synchronize_session=False)

    db.delete(agent)
    db.commit()
    return Response(status_code=204)


@router.post("/agents/{agent_id}/evaluate", status_code=202)
def evaluate(agent_id: str, body: EvaluateIn, background: BackgroundTasks,
             db: Session = Depends(get_db)):
    """Generate a suite if needed, register a version, and queue the whole run."""
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    if not agent.tool_schema:
        raise HTTPException(400, "Agent has no tools to test")

    profile = profile_agent(agent.system_prompt, agent.tool_schema)
    agent.profile = profile.to_dict()
    suite = generate(profile, per_category=body.perCategory, seed=body.seed)
    if not body.adversarial:
        suite = [spec for spec in suite if spec.category != "adversarial"]
    environment = MockEnvironment(**environment_for(profile, suite, f"{agent.name} sandbox"))
    db.add(environment); db.commit(); db.refresh(environment)

    scenarios = []
    for spec in suite:
        scenario = Scenario(name=spec.name, category=spec.category, subtype=spec.subtype,
                            initial_prompt=spec.initial_prompt,
                            expected_behavior=spec.expected_behavior,
                            mock_environment_id=environment.id, difficulty=spec.difficulty,
                            generator_version=GENERATOR_VERSION)
        db.add(scenario); scenarios.append(scenario)
    db.commit()

    config = ({"adapter": "http", "url": body.url} if body.adapter == "http" and body.url
              else {"adapter": "behavioral", "traits": body.traits})
    version = AgentVersion(agent_id=agent.id, version_label=body.versionLabel,
                           config_snapshot=config)
    db.add(version); db.commit(); db.refresh(version)

    for scenario in scenarios:
        db.refresh(scenario)
        run = TestRun(agent_version_id=version.id, scenario_id=scenario.id, seed=body.seed)
        db.add(run)
    db.commit()

    if SYNC_RUNS:
        # Start draining now; the progress endpoint finishes whatever does not fit.
        drain_pending(db, version.id)
    else:
        for run in db.query(TestRun).filter_by(agent_version_id=version.id, status="pending"):
            dispatch(background, run.id)

    return {"evaluationId": version.id, "agentId": agent.id, "total": len(scenarios),
            "version": version.version_label}


@router.get("/evaluations")
def list_evaluations(db: Session = Depends(get_db)):
    out = []
    for version in db.query(AgentVersion).order_by(AgentVersion.created_at.desc()):
        agent = db.get(Agent, version.agent_id)
        out.append(_version_evaluation(db, version, agent, include_tests=False))
    return out


@router.get("/evaluations/{evaluation_id}")
def read_evaluation(evaluation_id: str, db: Session = Depends(get_db)):
    version = db.get(AgentVersion, evaluation_id)
    if not version:
        raise HTTPException(404, "Evaluation not found")
    return _version_evaluation(db, version, db.get(Agent, version.agent_id), include_tests=True)


@router.get("/evaluations/{evaluation_id}/progress")
def evaluation_progress(evaluation_id: str, db: Session = Depends(get_db)):
    """Polled by the running-evaluation screen; also feeds its activity log."""
    version = db.get(AgentVersion, evaluation_id)
    if not version:
        raise HTTPException(404, "Evaluation not found")
    if SYNC_RUNS:
        drain_pending(db, evaluation_id)

    runs = db.query(TestRun).filter_by(agent_version_id=evaluation_id).all()
    done = [r for r in runs if r.status in ("complete", "error")]

    events = []
    for run in sorted(done, key=lambda r: r.completed_at or datetime(1970, 1, 1))[-12:]:
        scenario = db.get(Scenario, run.scenario_id)
        name = scenario.name if scenario else "scenario"
        label = {"pass": "passed", "warning": "passed with warnings"}.get(run.outcome, "FAILED")
        events.append(f"{name} — {label}")
        for annotation in db.query(FailureAnnotation).filter_by(test_run_id=run.id):
            events.append(f"  detected {CATEGORY_LABEL.get(annotation.failure_type)} "
                          f"({annotation.severity})")

    agent = db.get(Agent, version.agent_id)
    return {
        "evaluationId": evaluation_id,
        "agentName": agent.name if agent else "",
        "version": version.version_label,
        "total": len(runs),
        "completed": len(done),
        "status": "completed" if runs and len(done) == len(runs) else "running",
        "events": events[-14:],
    }


@router.post("/evaluations/{evaluation_id}/guardrail", status_code=202)
def start_guardrail(evaluation_id: str, background: BackgroundTasks,
                    db: Session = Depends(get_db)):
    """Queue the destructive-action pressure ladder for this version."""
    from .guardrail import build_ladder

    version = db.get(AgentVersion, evaluation_id)
    if not version:
        raise HTTPException(404, "Evaluation not found")
    agent = db.get(Agent, version.agent_id)
    profile = profile_agent(agent.system_prompt, agent.tool_schema)
    if not profile.destructive_tools:
        raise HTTPException(400, "This agent exposes no irreversible tools to probe")

    ladder = build_ladder(profile)
    environment = MockEnvironment(**environment_for(profile, ladder,
                                                    f"{agent.name} guardrail"))
    db.add(environment); db.commit(); db.refresh(environment)
    queued = []
    for spec in ladder:
        scenario = Scenario(name=spec.name, category=spec.category, subtype=spec.subtype,
                            initial_prompt=spec.initial_prompt,
                            expected_behavior=spec.expected_behavior,
                            mock_environment_id=environment.id,
                            difficulty=spec.difficulty, generator_version="guardrail-v1")
        db.add(scenario); db.commit(); db.refresh(scenario)
        run = TestRun(agent_version_id=version.id, scenario_id=scenario.id)
        db.add(run); db.commit(); db.refresh(run)
        dispatch(background, run.id)
        queued.append(run.id)
    return {"evaluationId": evaluation_id, "queued": len(queued)}


@router.get("/evaluations/{evaluation_id}/guardrail")
def guardrail(evaluation_id: str, db: Session = Depends(get_db)):
    from .guardrail import analyse

    version = db.get(AgentVersion, evaluation_id)
    if not version:
        raise HTTPException(404, "Evaluation not found")
    results = []
    for run in db.query(TestRun).filter_by(agent_version_id=evaluation_id, status="complete"):
        scenario = db.get(Scenario, run.scenario_id)
        marker = (scenario.expected_behavior or {}).get("guardrail") if scenario else None
        if not marker:
            continue
        breached = any(f.failure_type == "unsafe_action"
                       for f in db.query(FailureAnnotation).filter_by(test_run_id=run.id))
        results.append({"tool": marker["tool"], "level": marker["level"],
                        "technique": marker["technique"], "breached": breached,
                        "runId": run.id})
    if not results:
        return {"ran": False, "tools": [], "ladder": [], "resistanceScore": None}
    return {"ran": True, **analyse(results)}


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    runs = db.query(TestRun).filter_by(status="complete").all()
    scores = [r.reliability_score for r in runs if r.reliability_score is not None]
    average = round(sum(scores) / len(scores), 1) if scores else 0.0
    critical = db.query(FailureAnnotation).filter_by(severity="critical").count()

    # Trend: mean score per calendar day of completion.
    buckets: dict[str, list[float]] = {}
    for run in runs:
        if run.completed_at and run.reliability_score is not None:
            buckets.setdefault(run.completed_at.strftime("%b %d"), []).append(run.reliability_score)
    trend = [{"date": day, "score": round(sum(values) / len(values), 1)}
             for day, values in sorted(buckets.items())][-8:]

    versions = db.query(AgentVersion).order_by(AgentVersion.created_at).all()
    delta = 0.0
    if len(versions) > 1:
        delta = round(_version_score(db, versions[-1].id) - _version_score(db, versions[-2].id), 1)

    return {
        "averageReliability": average,
        "reliabilityDelta": delta,
        "agentsTested": db.query(Agent).count(),
        "testsExecuted": len(runs),
        "criticalFailures": critical,
        "verdict": verdict(average),
        "trend": trend,
    }
