import asyncio
import os
import socket
import time
from datetime import datetime, timedelta, timezone

import httpx

from . import mock_core
from .adapters import adapter_for
from .classifier import classify
from .database import IS_POSTGRES, SessionLocal, set_session_context
from .detectors import DETECTOR_VERSION, detect_all
from .provenance import evaluator_stamp
from .models import (Agent, AgentVersion, EvaluationJob, ExecutionTrace,
                     FailureAnnotation, MockEnvironment, Scenario, TestRun)
from .scoring import score_run
from .usage import refund_run, settle_run

MOCK_TOOL_URL = os.getenv("MOCK_TOOL_URL", "http://localhost:8001")
# Serverless has no second process to talk to, so the sandbox is imported instead.
MOCK_INLINE = os.getenv("MOCK_INLINE", "0") == "1"
MAX_STEPS = int(os.getenv("MAX_STEPS", "12"))
MAX_TOOL_CALLS = int(os.getenv("MAX_TOOL_CALLS", "10"))
MAX_WALL_SECONDS = int(os.getenv("MAX_WALL_SECONDS", "45"))


class EvaluationCancelled(Exception):
    pass


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class InlineSandbox:
    """In-process sandbox. Same code as the HTTP service, no network hop."""

    async def open(self, tools, state, injected, seed) -> str:
        return mock_core.start_session(tools, state, injected, seed)

    async def call(self, session_id, name, arguments) -> dict:
        return mock_core.call_tool(session_id, name, arguments)

    async def state(self, session_id) -> dict:
        return mock_core.session_state(session_id)["state"]

    async def close(self, session_id) -> None:
        mock_core.close_session(session_id)


class HttpSandbox:
    """Out-of-process sandbox: the agent cannot reach a real credential from here."""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=10)

    async def open(self, tools, state, injected, seed) -> str:
        response = await self.client.post(f"{self.base_url}/sessions", json={
            "tools": tools, "initial_state": state,
            "injected_content": injected, "seed": seed})
        response.raise_for_status()
        return response.json()["session_id"]

    async def call(self, session_id, name, arguments) -> dict:
        response = await self.client.post(
            f"{self.base_url}/sessions/{session_id}/tools/{name}",
            json={"arguments": arguments})
        response.raise_for_status()
        return response.json()

    async def state(self, session_id) -> dict:
        response = await self.client.get(f"{self.base_url}/sessions/{session_id}/state")
        response.raise_for_status()
        return response.json()["state"]

    async def close(self, session_id) -> None:
        try:
            await self.client.delete(f"{self.base_url}/sessions/{session_id}")
        except Exception:
            pass
        await self.client.aclose()


def sandbox_for():
    return InlineSandbox() if MOCK_INLINE else HttpSandbox(MOCK_TOOL_URL)


class StepCounter:
    """One monotonic sequence per run.

    Previously the tool_call reused the step number of the reasoning message before
    it, producing duplicate step numbers — `ORDER BY step_number` then returned them
    in arbitrary order and the trace UI drew a call before its own explanation.
    """

    def __init__(self) -> None:
        self._value = 0

    def next(self) -> int:
        self._value += 1
        return self._value

    @property
    def current(self) -> int:
        return self._value


# Committing every trace row keeps a partial trace if the process is killed, which
# is worth a local disk write. Against a remote pooler it is one network round-trip
# per step — 11 scenarios cost 151s that way. Batched, the rows still survive a
# crash because the except branch flushes whatever the session is holding.
COMMIT_EVERY_TRACE = os.getenv("COMMIT_EVERY_TRACE",
                               "0" if os.getenv("SERVERLESS") == "1" else "1") == "1"


def add_trace(db, run_id: str, workspace_id: str, steps: StepCounter,
              kind: str, payload: dict,
              latency_ms: int | None = None) -> int:
    number = steps.next()
    db.add(ExecutionTrace(workspace_id=workspace_id, test_run_id=run_id,
                          step_number=number, step_type=kind,
                          payload=payload, latency_ms=latency_ms))
    if COMMIT_EVERY_TRACE:
        db.commit()
    return number


async def run_test(run_id: str) -> None:
    db = SessionLocal()
    set_session_context(db, worker=True)
    sandbox = sandbox_for()
    session_id = None
    steps = StepCounter()
    began_run = time.monotonic()
    try:
        run = db.get(TestRun, run_id)
        if run is None:
            return
        set_session_context(db, workspace_id=run.workspace_id)
        claimed = db.query(TestRun).filter_by(id=run_id, status="pending").update(
            {"status": "running", "started_at": now()}, synchronize_session=False)
        db.commit()
        if not claimed:
            return
        db.refresh(run)
        version = db.get(AgentVersion, run.agent_version_id)
        scenario = db.get(Scenario, run.scenario_id)
        environment = db.get(MockEnvironment, scenario.mock_environment_id)
        agent = db.get(Agent, version.agent_id)

        # Scenario-scoped injection wins; the environment's is only a fallback for
        # suites built before payloads were per-scenario.
        injected = getattr(scenario, "injected_content", None) or environment.injected_content
        # Scenario-scoped sandbox tweaks (a tool that always errors, for instance)
        # are merged for this run only, so one scenario cannot break the others.
        definitions = dict(environment.tool_definitions or {})
        for name, patch in ((scenario.expected_behavior or {})
                            .get("sandbox_overrides", {}) or {}).items():
            if name in definitions:
                definitions[name] = {**definitions[name], **patch}
        session_id = await sandbox.open(definitions,
                                        environment.initial_state,
                                        injected, run.seed)

        # Rotation is derived from the run id so the model a scenario uses is
        # stable across replays and spread evenly across the pool.
        #
        # The guardrail ladder is the exception and pins to one model: its whole
        # output is "which rung did THIS agent fold at", and a ladder whose rungs
        # ran on different models cannot answer that. Spreading load matters less
        # than the number meaning something.
        is_guardrail = bool((scenario.expected_behavior or {}).get("guardrail"))
        rotation = 0 if is_guardrail else int(run.id.replace("-", "")[:8], 16)
        adapter_config = dict(version.config_snapshot or {})
        if adapter_config.get("adapter") == "http":
            endpoint_config = agent.endpoint_config or {}
            encrypted = endpoint_config.get("bearer_token_encrypted")
            if encrypted and endpoint_config.get("url") == adapter_config.get("url"):
                from .secret_store import decrypt_secret

                token = decrypt_secret(
                    encrypted,
                    context=f"agent-endpoint:{adapter_config['url']}",
                )
                adapter_config["headers"] = {"Authorization": f"Bearer {token}"}
        adapter = adapter_for(adapter_config, rotation=rotation)
        messages = [{"role": "user", "content": scenario.initial_prompt}]
        add_trace(db, run_id, run.workspace_id, steps, "agent_message",
                  {"role": "user", "content": scenario.initial_prompt})

        turns, tool_calls, began = 0, 0, time.monotonic()
        while (turns < MAX_STEPS and tool_calls < MAX_TOOL_CALLS
               and time.monotonic() - began < MAX_WALL_SECONDS):
            job = db.query(EvaluationJob).filter_by(test_run_id=run_id).first()
            if job:
                db.refresh(job)
                if job.status == "cancel_requested":
                    raise EvaluationCancelled("Evaluation was canceled")
            turns += 1
            began_action = time.monotonic()
            remaining = MAX_WALL_SECONDS - (time.monotonic() - began)
            try:
                action = await asyncio.wait_for(adapter.next_action(messages, definitions),
                                                timeout=max(0.001, remaining))
            except TimeoutError as exc:
                raise TimeoutError("The model exceeded the scenario time limit") from exc
            elapsed = int((time.monotonic() - began_action) * 1000)

            if action.get("type") == "final":
                content = action.get("content", "")
                add_trace(db, run_id, run.workspace_id, steps, "agent_message",
                          {"role": "assistant", "content": content, "final": True}, elapsed)
                messages.append({"role": "assistant", "content": content})
                break

            if action.get("type") != "tool_call" or not action.get("tool_name"):
                raise ValueError("Agent adapter returned neither final nor a valid tool_call")

            # An intermediate rationale gets its own step so the drift detector can
            # inspect it independently of the call it accompanies.
            if action.get("content"):
                content = action["content"]
                add_trace(db, run_id, run.workspace_id, steps, "agent_message",
                          {"role": "assistant", "content": content, "final": False}, elapsed)
                messages.append({"role": "assistant", "content": content})

            tool_calls += 1
            name, arguments = action["tool_name"], action.get("arguments", {})
            add_trace(db, run_id, run.workspace_id, steps, "tool_call",
                      {"tool_name": name, "arguments": arguments}, elapsed)

            result_started = time.monotonic()
            result = await sandbox.call(session_id, name, arguments)
            add_trace(db, run_id, run.workspace_id, steps, "tool_result",
                      {"tool_name": name, **result},
                      int((time.monotonic() - result_started) * 1000))
            messages += [
                {"role": "assistant", "tool_call": {"name": name, "arguments": arguments}},
                {"role": "tool", "name": name, "content": result},
            ]
        else:
            add_trace(db, run_id, run.workspace_id, steps, "error",
                      {"reason": "execution limit exceeded"})

        final_state = await sandbox.state(session_id)
        db.commit()   # flush batched traces so the detectors can read them back

        traces = (db.query(ExecutionTrace)
                    .filter_by(test_run_id=run_id)
                    .order_by(ExecutionTrace.step_number).all())

        from .introspect import profile_agent

        snapshot = version.config_snapshot or {}
        trusted = snapshot.get("system_prompt_at_version", agent.system_prompt or "")
        tool_schema = snapshot.get("tool_schema_at_version", agent.tool_schema or {})
        profile = profile_agent(trusted, tool_schema)
        schemas = {t["name"]: t for t in profile.to_dict().get("tools", [])}
        findings = detect_all(traces, definitions,
                              scenario.expected_behavior, scenario.initial_prompt,
                              final_state, schemas,
                              trusted_context=trusted)
        annotations = classify(findings)
        for annotation in annotations:
            db.add(FailureAnnotation(workspace_id=run.workspace_id, test_run_id=run_id,
                                     detector_version=DETECTOR_VERSION,
                                     **annotation))

        # Record which model actually served the run, so a report can show whether
        # a pool failover changed the agent under test partway through.
        served = sorted(set(getattr(adapter, "served_by", []) or []))
        if served:
            add_trace(db, run_id, run.workspace_id, steps, "meta",
                      {"models_used": served,
                       "primary": getattr(adapter, "model", None)})

        outcome, score, breakdown = score_run(annotations, final_state,
                                              scenario.expected_behavior, traces)
        run.outcome, run.reliability_score, run.metrics = outcome, score, breakdown
        run.final_state, run.status, run.completed_at = final_state, "complete", now()
        run.duration_ms = int((time.monotonic() - began_run) * 1000)
        usage = getattr(adapter, "usage", {}) or {}
        run.input_tokens = int(usage.get("input_tokens") or 0)
        run.output_tokens = int(usage.get("output_tokens") or 0)
        input_rate = float(os.getenv("LLM_INPUT_COST_PER_MILLION", "0"))
        output_rate = float(os.getenv("LLM_OUTPUT_COST_PER_MILLION", "0"))
        run.estimated_cost_usd = round(
            (run.input_tokens * input_rate + run.output_tokens * output_rate)
            / 1_000_000, 8)
        # Stamp what graded it. A verdict nobody can trace back to a specific
        # evaluator is a verdict nobody can reproduce.
        run.provenance = evaluator_stamp(scenario.generator_version)
        db.commit()

    except Exception as exc:
        # Preserve already recorded evidence when the provider fails mid-run.
        # A database failure still requires a rollback before recording the error.
        try:
            db.commit()
        except Exception:
            db.rollback()
        run = db.get(TestRun, run_id)
        if run:
            set_session_context(db, workspace_id=run.workspace_id)
            run.status = "canceled" if isinstance(exc, EvaluationCancelled) else "error"
            run.completed_at = now()
            run.duration_ms = int((time.monotonic() - began_run) * 1000)
            db.add(ExecutionTrace(workspace_id=run.workspace_id,
                                  test_run_id=run_id, step_number=steps.current + 1,
                                  step_type="error", payload={
                                      "reason": str(exc),
                                      "kind": type(exc).__name__,
                                      "retryable": _retryable_failure(exc),
                                  }))
            db.commit()
    finally:
        if session_id:
            try:
                await sandbox.close(session_id)
            except Exception:
                pass
        db.close()


SYNC_RUNS = os.getenv("SYNC_RUNS", "0") == "1"
DURABLE_QUEUE = os.getenv(
    "AEGIS_DURABLE_QUEUE", "1" if IS_POSTGRES else "0") == "1"
JOB_LEASE_SECONDS = int(os.getenv("JOB_LEASE_SECONDS", "120"))


def _retryable_failure(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        return status in {408, 409, 425, 429} or status >= 500
    return isinstance(exc, (TimeoutError, httpx.TransportError, ConnectionError, OSError))


def enqueue_run(db, run: TestRun, reservation_id: str | None = None) -> EvaluationJob:
    job = db.query(EvaluationJob).filter_by(test_run_id=run.id).first()
    if job:
        if reservation_id and not job.reservation_id:
            job.reservation_id = reservation_id
        return job
    job = EvaluationJob(
        workspace_id=run.workspace_id,
        test_run_id=run.id,
        reservation_id=reservation_id,
    )
    db.add(job)
    return job


def _finalize_job(job_id: str) -> None:
    db = SessionLocal()
    notification_target: tuple[str, str] | None = None
    try:
        set_session_context(db, worker=True)
        job = db.get(EvaluationJob, job_id)
        if not job:
            return
        set_session_context(db, workspace_id=job.workspace_id)
        run = db.get(TestRun, job.test_run_id)
        if not run:
            job.status = "failed"
            job.last_error = "Test run was deleted"
            job.completed_at = now()
        elif job.status == "cancel_requested" or run.status == "canceled":
            job.status = "canceled"
            job.completed_at = now()
            job.lease_owner = None
            job.lease_until = None
            refund_run(db, job.reservation_id, run.id, job.workspace_id,
                       "Evaluation canceled")
        elif run.status == "complete":
            job.status = "completed"
            job.completed_at = now()
            job.lease_owner = None
            job.lease_until = None
            settle_run(
                db,
                job.reservation_id,
                run.id,
                job.workspace_id,
                input_tokens=run.input_tokens,
                output_tokens=run.output_tokens,
                estimated_cost_usd=run.estimated_cost_usd,
            )
        else:
            error_trace = (db.query(ExecutionTrace)
                           .filter_by(test_run_id=run.id, step_type="error")
                           .order_by(ExecutionTrace.step_number.desc()).first())
            detail = (error_trace.payload if error_trace else {}) or {}
            job.last_error = str(detail.get("reason") or "Evaluation failed")[:1000]
            if detail.get("retryable") and job.attempts < job.max_attempts:
                # Retry transient provider/network failures from a clean trace.
                # The original reservation stays held until a terminal outcome.
                db.query(ExecutionTrace).filter_by(
                    test_run_id=run.id).delete(synchronize_session=False)
                db.query(FailureAnnotation).filter_by(
                    test_run_id=run.id).delete(synchronize_session=False)
                run.status = "pending"
                run.started_at = None
                run.completed_at = None
                run.outcome = None
                run.reliability_score = None
                run.metrics = None
                run.final_state = None
                job.status = "queued"
                job.available_at = now() + timedelta(
                    seconds=min(60, 5 * (2 ** max(job.attempts - 1, 0))))
                job.lease_owner = None
                job.lease_until = None
                job.completed_at = None
            else:
                job.status = "failed"
                job.completed_at = now()
                job.lease_owner = None
                job.lease_until = None
                refund_run(db, job.reservation_id, run.id, job.workspace_id,
                           job.last_error)
        db.commit()
        if run and job.status in {"completed", "failed", "canceled"}:
            notification_target = (run.agent_version_id, job.workspace_id)
    finally:
        db.close()
    if notification_target:
        from .notifications import send_evaluation_notification

        try:
            send_evaluation_notification(*notification_target)
        except Exception:
            # The evaluation is already durable and settled. Delivery state is
            # retried separately and must not make a worker re-run the scenario.
            pass


def execute_job(job_id: str) -> None:
    """Run one already-claimed job and settle it exactly once."""
    db = SessionLocal()
    try:
        set_session_context(db, worker=True)
        job = db.get(EvaluationJob, job_id)
        if not job:
            return
        set_session_context(db, workspace_id=job.workspace_id)
        run = db.get(TestRun, job.test_run_id)
        if not run:
            job.status = "failed"
            job.last_error = "Test run was deleted"
            job.completed_at = now()
            db.commit()
            return
        if job.status == "queued":
            job.status = "running"
            job.attempts += 1
            job.lease_owner = f"inline:{socket.gethostname()}"
            job.lease_until = now() + timedelta(seconds=JOB_LEASE_SECONDS)
            db.commit()
        run_id = run.id
        already_complete = run.status == "complete"
    finally:
        db.close()
    if not already_complete:
        asyncio.run(run_test(run_id))
    _finalize_job(job_id)


def claim_next_job(worker_id: str) -> str | None:
    """Atomically claim a queued or expired job using SKIP LOCKED on Postgres."""
    from sqlalchemy import or_, text

    from .models import Subscription, Workspace
    from .plans import plan_for

    db = SessionLocal()
    try:
        set_session_context(db, worker=True)
        current = now()
        selected = None
        seen: list[str] = []
        for _ in range(20):
            query = (
                db.query(EvaluationJob)
                .filter(
                    or_(
                        (EvaluationJob.status == "queued")
                        & (EvaluationJob.available_at <= current),
                        (EvaluationJob.status == "running")
                        & (EvaluationJob.lease_until < current),
                    ),
                    EvaluationJob.attempts < EvaluationJob.max_attempts,
                    EvaluationJob.id.notin_(seen),
                )
                .order_by(EvaluationJob.available_at, EvaluationJob.created_at)
                .limit(1)
            )
            if IS_POSTGRES:
                query = query.with_for_update(skip_locked=True)
            candidate = query.first()
            if candidate is None:
                break
            seen.append(candidate.id)
            workspace = db.get(
                Workspace,
                candidate.workspace_id,
                execution_options={"include_all_workspaces": True},
            )
            if IS_POSTGRES:
                # Serialise the active-count decision per workspace. Row locks
                # alone are insufficient because two workers can lock different
                # queued jobs, both observe zero active jobs, and exceed a plan's
                # concurrency limit before either commit becomes visible.
                db.execute(
                    text("select pg_advisory_xact_lock(hashtext(:workspace_id))"),
                    {"workspace_id": candidate.workspace_id},
                )
            subscription = db.get(Subscription, workspace.organization_id) if workspace else None
            concurrency = plan_for(subscription.plan if subscription else "trial").concurrency
            active = (
                db.query(EvaluationJob)
                .execution_options(include_all_workspaces=True)
                .filter(EvaluationJob.workspace_id == candidate.workspace_id,
                        EvaluationJob.status == "running",
                        EvaluationJob.lease_until >= current,
                        EvaluationJob.id != candidate.id)
                .count()
            )
            if active < concurrency:
                selected = candidate
                break
        if not selected:
            db.rollback()
            return None

        run = db.get(
            TestRun,
            selected.test_run_id,
            execution_options={"include_all_workspaces": True},
        )
        if selected.status == "running" and run and run.status == "running":
            # The previous worker died mid-run. Start from a clean attempt so
            # duplicate step numbers cannot corrupt a trace.
            db.query(ExecutionTrace).execution_options(
                include_all_workspaces=True).filter_by(
                test_run_id=run.id).delete(synchronize_session=False)
            db.query(FailureAnnotation).execution_options(
                include_all_workspaces=True).filter_by(
                test_run_id=run.id).delete(synchronize_session=False)
            run.status = "pending"
            run.started_at = None
            run.completed_at = None
            run.outcome = None
            run.reliability_score = None
        selected.status = "running"
        selected.attempts += 1
        selected.lease_owner = worker_id
        selected.lease_until = current + timedelta(seconds=JOB_LEASE_SECONDS)
        db.commit()
        return selected.id
    finally:
        db.close()


def dispatch(background, run_id: str) -> None:
    """Ensure a durable job exists, then execute only in explicit local modes."""
    db = SessionLocal()
    try:
        set_session_context(db, worker=True)
        run = db.get(TestRun, run_id)
        if not run:
            return
        set_session_context(db, workspace_id=run.workspace_id)
        job = enqueue_run(db, run)
        db.commit()
        job_id = job.id
    finally:
        db.close()
    if SYNC_RUNS:
        execute_job(job_id)
    elif not DURABLE_QUEUE:
        background.add_task(execute_job, job_id)


RUN_BUDGET_SECONDS = float(os.getenv("RUN_BUDGET_SECONDS", "20"))


def drain_pending(db, version_id: str, budget: float | None = None) -> int:
    """Compatibility helper for local/test synchronous execution only."""
    if DURABLE_QUEUE and not SYNC_RUNS:
        return 0
    budget = RUN_BUDGET_SECONDS if budget is None else budget
    started = time.monotonic()
    completed = 0
    while time.monotonic() - started < budget:
        db.expire_all()
        pending = (db.query(TestRun)
                     .filter_by(agent_version_id=version_id, status="pending")
                     .order_by(TestRun.id).first())
        if pending is None:
            break
        job = enqueue_run(db, pending)
        db.commit()
        execute_job(job.id)
        completed += 1
    return completed
