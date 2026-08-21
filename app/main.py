from contextlib import asynccontextmanager
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .classifier import TAXONOMY, classify
from .database import Base, engine, get_db
from .detectors import DETECTOR_VERSION, detect_all
from .frontend_api import router as frontend_router
from .engine import dispatch, run_test
from .guardrail import analyse as guardrail_analyse
from .guardrail import build_ladder
from .scoring import score_run
from .introspect import profile_agent
from .models import (Agent, AgentVersion, ExecutionTrace, FailureAnnotation,
                     MockEnvironment, Scenario, TestRun)
from .reporting import compare_report, run_report, run_summary, version_report
from .scenarios import GENERATOR_VERSION, environment_for, generate
from .schemas import (AgentIn, EnvironmentIn, GenerateSuiteIn, IntrospectIn, RunIn,
                      ScenarioIn, VersionIn)


DB_READY = {"ok": False, "error": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables if we can, but never let a bad database kill the process.

    On a read-only serverless filesystem the default SQLite URL cannot even be
    created, and raising here turns every route — including /health — into an
    opaque 500. Recording the failure instead means the deployment comes up and
    can say precisely what is wrong.
    """
    try:
        Base.metadata.create_all(bind=engine)
        DB_READY["ok"] = True
    except Exception as exc:  # noqa: BLE001 - surfaced through /health
        DB_READY["error"] = f"{type(exc).__name__}: {exc}"[:400]
    yield


app = FastAPI(title="Aegis — Agent Evaluation & Reliability API", version="1.0.0",
              lifespan=lifespan)

# The dashboard is served from a different origin in every environment we use
# (Lovable preview, localhost, deployed). Locked down to the verbs the UI uses.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
                        r"|https://.*\.lovable\.app"
                        r"|https://.*\.trycloudflare\.com"),
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def view(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def require(db: Session, model, object_id: str):
    row = db.get(model, object_id)
    if not row:
        raise HTTPException(404, f"{model.__name__} '{object_id}' not found")
    return row


def _rows_for_version(db: Session, version_id: str) -> tuple[list[dict], dict[str, list]]:
    """Latest completed run per scenario, plus its failures."""
    from .frontend_api import _exclude_guardrail

    runs = (_exclude_guardrail(db.query(TestRun))
              .filter(TestRun.agent_version_id == version_id,
                      TestRun.status == "complete")
              .order_by(TestRun.completed_at).all())
    latest: dict[str, TestRun] = {r.scenario_id: r for r in runs}
    rows, failures_by_run = [], {}
    for run in latest.values():
        scenario = db.get(Scenario, run.scenario_id)
        failures = db.query(FailureAnnotation).filter_by(test_run_id=run.id).all()
        failures_by_run[run.id] = failures
        rows.append(run_summary(run, scenario, failures))
    rows.sort(key=lambda r: (r["category"], r["scenario"]))
    return rows, failures_by_run


# --------------------------------------------------------------------------- #
# health & metadata
# --------------------------------------------------------------------------- #
app.include_router(frontend_router)

@app.get("/", include_in_schema=False)
def root():
    """The dashboard is the only UI; it proxies /api to this service on one origin."""
    return {"service": "Aegis evaluator API", "docs": "/docs",
            "dashboard": "served by the frontend, which proxies /api here"}


@app.get("/health")
def health():
    if DB_READY["ok"]:
        return {"status": "ok", "database": "connected", "generator": GENERATOR_VERSION}
    return {
        "status": "degraded",
        "database": "unavailable",
        "detail": DB_READY["error"],
        "fix": "Set DATABASE_URL in the deployment environment, then redeploy.",
        "generator": GENERATOR_VERSION,
    }


@app.get("/taxonomy")
def taxonomy():
    """The six failure classes — the single source of truth for the UI's charts."""
    return {"failure_types": [{"key": key, **value} for key, value in TAXONOMY.items()]}


# --------------------------------------------------------------------------- #
# agents
# --------------------------------------------------------------------------- #
@app.post("/agents", status_code=201)
def create_agent(body: AgentIn, db: Session = Depends(get_db)):
    if db.query(Agent).filter(Agent.name == body.name).first():
        raise HTTPException(409, f"An agent named '{body.name}' already exists.")
    item = Agent(**body.model_dump())
    if item.system_prompt or item.tool_schema:
        item.profile = profile_agent(item.system_prompt, item.tool_schema).to_dict()
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"An agent named '{body.name}' already exists.")
    db.refresh(item)
    return view(item)


@app.get("/agents")
def list_agents(db: Session = Depends(get_db)):
    return [view(a) for a in db.query(Agent).order_by(Agent.created_at)]


@app.get("/agents/{agent_id}")
def read_agent(agent_id: str, db: Session = Depends(get_db)):
    return view(require(db, Agent, agent_id))


@app.post("/agents/{agent_id}/introspect")
def introspect(agent_id: str, body: IntrospectIn, db: Session = Depends(get_db)):
    """Agent input analysis: read the prompt and tools, infer risk and constraints."""
    agent = require(db, Agent, agent_id)
    system_prompt = body.system_prompt if body.system_prompt is not None else agent.system_prompt
    tool_schema = body.tool_schema if body.tool_schema is not None else agent.tool_schema
    if not system_prompt and not tool_schema:
        raise HTTPException(400, "Provide system_prompt or tool_schema to introspect")
    profile = profile_agent(system_prompt, tool_schema, body.domain)
    agent.system_prompt, agent.tool_schema = system_prompt, tool_schema
    agent.profile = profile.to_dict()
    db.commit()
    return agent.profile


@app.post("/agents/{agent_id}/versions", status_code=201)
def create_version(agent_id: str, body: VersionIn, db: Session = Depends(get_db)):
    require(db, Agent, agent_id)
    item = AgentVersion(agent_id=agent_id, **body.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return view(item)


@app.get("/agents/{agent_id}/versions")
def list_versions(agent_id: str, db: Session = Depends(get_db)):
    require(db, Agent, agent_id)
    return [view(v) for v in db.query(AgentVersion).filter_by(agent_id=agent_id)
            .order_by(AgentVersion.created_at)]


# --------------------------------------------------------------------------- #
# scenario generation
# --------------------------------------------------------------------------- #
@app.post("/agents/{agent_id}/generate-suite", status_code=201)
def generate_suite(agent_id: str, body: GenerateSuiteIn, db: Session = Depends(get_db)):
    """Scenario Generation Engine: profile in, runnable sandbox and suite out."""
    agent = require(db, Agent, agent_id)
    system_prompt = body.system_prompt if body.system_prompt is not None else agent.system_prompt
    tool_schema = body.tool_schema if body.tool_schema is not None else agent.tool_schema
    if not tool_schema:
        raise HTTPException(400, "Agent has no tool_schema; introspect or supply one first")

    profile = profile_agent(system_prompt, tool_schema)
    agent.system_prompt, agent.tool_schema = system_prompt, tool_schema
    agent.profile = profile.to_dict()

    suite = generate(profile, per_category=body.per_category, seed=body.seed)
    environment_spec = environment_for(profile, suite, body.environment_name)
    environment = MockEnvironment(**environment_spec)
    db.add(environment); db.commit(); db.refresh(environment)

    created = []
    for spec in suite:
        scenario = Scenario(
            name=spec.name, category=spec.category, subtype=spec.subtype,
            initial_prompt=spec.initial_prompt, expected_behavior=spec.expected_behavior,
            mock_environment_id=environment.id, difficulty=spec.difficulty,
            generator_version=GENERATOR_VERSION,
            injected_content=spec.injected_content,
                            fingerprint=spec.fingerprint)
        db.add(scenario); created.append(scenario)
    db.commit()
    for scenario in created:
        db.refresh(scenario)

    return {"profile": agent.profile, "mock_environment": view(environment),
            "scenarios": [view(s) for s in created], "count": len(created)}


@app.post("/mock-environments", status_code=201)
def create_environment(body: EnvironmentIn, db: Session = Depends(get_db)):
    item = MockEnvironment(**body.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return view(item)


@app.post("/scenarios", status_code=201)
def create_scenario(body: ScenarioIn, db: Session = Depends(get_db)):
    require(db, MockEnvironment, body.mock_environment_id)
    item = Scenario(**body.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return view(item)


@app.get("/scenarios")
def list_scenarios(db: Session = Depends(get_db)):
    return [view(s) for s in db.query(Scenario).order_by(Scenario.category)]


# --------------------------------------------------------------------------- #
# execution
# --------------------------------------------------------------------------- #
@app.post("/agents/{agent_id}/versions/{version_id}/run", status_code=202)
def start_runs(agent_id: str, version_id: str, body: RunIn, background: BackgroundTasks,
               db: Session = Depends(get_db)):
    """Queue one run per scenario.

    Uses BackgroundTasks rather than asyncio.create_task: this handler is sync, so
    it executes in a threadpool worker where there is no running event loop.
    """
    version = require(db, AgentVersion, version_id)
    if version.agent_id != agent_id:
        raise HTTPException(400, "Version does not belong to this agent")

    scenario_ids = list(body.scenario_ids)
    if body.all_scenarios or not scenario_ids:
        scenario_ids = [s.id for s in db.query(Scenario).order_by(Scenario.category)]
    if not scenario_ids:
        raise HTTPException(400, "No scenarios to run; generate a suite first")

    runs = []
    for scenario_id in scenario_ids:
        require(db, Scenario, scenario_id)
        run = TestRun(agent_version_id=version_id, scenario_id=scenario_id, seed=body.seed)
        db.add(run); db.commit(); db.refresh(run)
        dispatch(background, run.id)
        runs.append(view(run))
    return {"runs": runs, "queued": len(runs)}


@app.get("/test-runs/{run_id}")
def read_run(run_id: str, db: Session = Depends(get_db)):
    return view(require(db, TestRun, run_id))


@app.get("/test-runs/{run_id}/traces")
def traces(run_id: str, db: Session = Depends(get_db)):
    require(db, TestRun, run_id)
    return [view(t) for t in db.query(ExecutionTrace).filter_by(test_run_id=run_id)
            .order_by(ExecutionTrace.step_number)]


@app.get("/test-runs/{run_id}/failures")
def failures(run_id: str, db: Session = Depends(get_db)):
    require(db, TestRun, run_id)
    return [view(f) for f in db.query(FailureAnnotation).filter_by(test_run_id=run_id)]


@app.get("/test-runs/{run_id}/report")
def run_detail(run_id: str, db: Session = Depends(get_db)):
    """Everything the report page needs, including a trace with flagged steps."""
    run = require(db, TestRun, run_id)
    scenario = db.get(Scenario, run.scenario_id)
    trace_rows = (db.query(ExecutionTrace).filter_by(test_run_id=run_id)
                    .order_by(ExecutionTrace.step_number).all())
    failure_rows = db.query(FailureAnnotation).filter_by(test_run_id=run_id).all()
    return run_report(run, scenario, trace_rows, failure_rows)


@app.post("/test-runs/{run_id}/reanalyze")
def reanalyze(run_id: str, db: Session = Depends(get_db)):
    """Deterministic replay: re-grade a stored trace without re-running the agent.

    This is the half of "replay" that is actually reproducible. Re-executing a real
    LLM agent gives a different trace every time, so it cannot verify a detector
    change. Replaying the *recorded* trace through the current detectors can — and
    it costs no model calls, so an improved detector can be applied to the entire
    run history at once.
    """
    run = require(db, TestRun, run_id)
    scenario = db.get(Scenario, run.scenario_id)
    environment = db.get(MockEnvironment, scenario.mock_environment_id) if scenario else None
    version = db.get(AgentVersion, run.agent_version_id)
    agent = db.get(Agent, version.agent_id) if version else None

    traces = (db.query(ExecutionTrace).filter_by(test_run_id=run_id)
                .order_by(ExecutionTrace.step_number).all())
    if not traces:
        raise HTTPException(400, "Run has no stored trace to replay")

    previous = {"outcome": run.outcome, "score": run.reliability_score,
                "failures": sorted({f.failure_type for f in
                                    db.query(FailureAnnotation).filter_by(test_run_id=run_id)})}

    schemas = {t["name"]: t for t in (agent.profile or {}).get("tools", [])} if agent else {}
    findings = detect_all(traces, environment.tool_definitions if environment else {},
                          scenario.expected_behavior if scenario else {},
                          scenario.initial_prompt if scenario else "",
                          run.final_state or {}, schemas)
    annotations = classify(findings)

    for stale in db.query(FailureAnnotation).filter_by(test_run_id=run_id):
        db.delete(stale)
    for annotation in annotations:
        db.add(FailureAnnotation(test_run_id=run_id, detector_version=DETECTOR_VERSION,
                                 **annotation))
    outcome, score, breakdown = score_run(annotations, run.final_state or {},
                                          scenario.expected_behavior if scenario else {}, traces)
    run.outcome, run.reliability_score, run.metrics = outcome, score, breakdown
    db.commit()

    current = {"outcome": outcome, "score": score,
               "failures": sorted({a["failure_type"] for a in annotations})}
    return {"run_id": run_id, "detector_version": DETECTOR_VERSION,
            "before": previous, "after": current,
            "changed": previous != current, "steps_replayed": len(traces)}


@app.post("/test-runs/{run_id}/replay", status_code=202)
def replay(run_id: str, background: BackgroundTasks, db: Session = Depends(get_db)):
    original = require(db, TestRun, run_id)
    cloned = TestRun(agent_version_id=original.agent_version_id,
                     scenario_id=original.scenario_id, seed=original.seed,
                     replayed_from_run_id=original.id)
    db.add(cloned); db.commit(); db.refresh(cloned)
    dispatch(background, cloned.id)
    return view(cloned)


# --------------------------------------------------------------------------- #
# reports
# --------------------------------------------------------------------------- #
@app.post("/agents/{agent_id}/versions/{version_id}/guardrail", status_code=202)
def guardrail_test(agent_id: str, version_id: str, background: BackgroundTasks,
                   seed: int = 0, db: Session = Depends(get_db)):
    """Destructive Action Guardrail Tester — queue the escalating pressure ladder."""
    agent = require(db, Agent, agent_id)
    version = require(db, AgentVersion, version_id)
    if version.agent_id != agent_id:
        raise HTTPException(400, "Version does not belong to this agent")

    profile = profile_agent(agent.system_prompt, agent.tool_schema)
    if not profile.destructive_tools:
        raise HTTPException(400, "Agent exposes no irreversible tools to probe")

    ladder = build_ladder(profile)
    environment = MockEnvironment(**environment_for(profile, ladder,
                                                    f"{agent.name} guardrail sandbox"))
    db.add(environment); db.commit(); db.refresh(environment)

    queued = []
    for spec in ladder:
        scenario = Scenario(name=spec.name, category=spec.category, subtype=spec.subtype,
                            initial_prompt=spec.initial_prompt,
                            expected_behavior=spec.expected_behavior,
                            mock_environment_id=environment.id, difficulty=spec.difficulty,
                            generator_version="guardrail-v1",
                            injected_content=spec.injected_content,
                            fingerprint=spec.fingerprint)
        db.add(scenario); db.commit(); db.refresh(scenario)
        run = TestRun(agent_version_id=version_id, scenario_id=scenario.id, seed=seed)
        db.add(run); db.commit(); db.refresh(run)
        dispatch(background, run.id)
        queued.append(run.id)
    return {"queued": len(queued), "run_ids": queued, "version_id": version_id}


@app.get("/agents/{agent_id}/versions/{version_id}/guardrail")
def guardrail_report(agent_id: str, version_id: str, db: Session = Depends(get_db)):
    """Breaking point per irreversible tool, and an overall resistance score."""
    version = require(db, AgentVersion, version_id)
    if version.agent_id != agent_id:
        raise HTTPException(400, "Version does not belong to this agent")

    results = []
    runs = (db.query(TestRun)
              .filter_by(agent_version_id=version_id, status="complete").all())
    # Probes that errored are counted as not-run, never as held.
    not_run = 0
    for failed in db.query(TestRun).filter_by(agent_version_id=version_id, status="error"):
        scenario = db.get(Scenario, failed.scenario_id)
        if scenario and (scenario.expected_behavior or {}).get("guardrail"):
            not_run += 1
    for run in runs:
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
        raise HTTPException(404, "No guardrail runs found for this version")
    return guardrail_analyse(results, not_run=not_run)


@app.get("/agents/{agent_id}/versions/{version_id}/report")
def version_rollup(agent_id: str, version_id: str, db: Session = Depends(get_db)):
    version = require(db, AgentVersion, version_id)
    if version.agent_id != agent_id:
        raise HTTPException(400, "Version does not belong to this agent")
    agent = db.get(Agent, agent_id)
    rows, failures_by_run = _rows_for_version(db, version_id)
    return version_report(version, agent, rows, failures_by_run)


@app.get("/versions/{older_version_id}/compare/{newer_version_id}")
def compare_versions(older_version_id: str, newer_version_id: str, db: Session = Depends(get_db)):
    older = require(db, AgentVersion, older_version_id)
    newer = require(db, AgentVersion, newer_version_id)
    old_rows, _ = _rows_for_version(db, older_version_id)
    new_rows, _ = _rows_for_version(db, newer_version_id)
    return compare_report(older, newer, old_rows, new_rows)
