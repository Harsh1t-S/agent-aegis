import asyncio
import os
import time
from datetime import datetime, timezone

import httpx

from . import mock_core
from .adapters import adapter_for
from .classifier import classify
from .database import SessionLocal
from .detectors import DETECTOR_VERSION, detect_all
from .provenance import evaluator_stamp
from .models import (Agent, AgentVersion, ExecutionTrace, FailureAnnotation,
                     MockEnvironment, Scenario, TestRun)
from .scoring import score_run

MOCK_TOOL_URL = os.getenv("MOCK_TOOL_URL", "http://localhost:8001")
# Serverless has no second process to talk to, so the sandbox is imported instead.
MOCK_INLINE = os.getenv("MOCK_INLINE", "0") == "1"
MAX_STEPS = int(os.getenv("MAX_STEPS", "12"))
MAX_TOOL_CALLS = int(os.getenv("MAX_TOOL_CALLS", "10"))
MAX_WALL_SECONDS = int(os.getenv("MAX_WALL_SECONDS", "45"))


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


def add_trace(db, run_id: str, steps: StepCounter, kind: str, payload: dict,
              latency_ms: int | None = None) -> int:
    number = steps.next()
    db.add(ExecutionTrace(test_run_id=run_id, step_number=number, step_type=kind,
                          payload=payload, latency_ms=latency_ms))
    if COMMIT_EVERY_TRACE:
        db.commit()
    return number


async def run_test(run_id: str) -> None:
    db = SessionLocal()
    sandbox = sandbox_for()
    session_id = None
    steps = StepCounter()
    began_run = time.monotonic()
    try:
        run = db.get(TestRun, run_id)
        if run is None:
            return
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
        adapter = adapter_for(version.config_snapshot, rotation=rotation)
        messages = [{"role": "user", "content": scenario.initial_prompt}]
        add_trace(db, run_id, steps, "agent_message",
                  {"role": "user", "content": scenario.initial_prompt})

        turns, tool_calls, began = 0, 0, time.monotonic()
        while (turns < MAX_STEPS and tool_calls < MAX_TOOL_CALLS
               and time.monotonic() - began < MAX_WALL_SECONDS):
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
                add_trace(db, run_id, steps, "agent_message",
                          {"role": "assistant", "content": content, "final": True}, elapsed)
                messages.append({"role": "assistant", "content": content})
                break

            if action.get("type") != "tool_call" or not action.get("tool_name"):
                raise ValueError("Agent adapter returned neither final nor a valid tool_call")

            # An intermediate rationale gets its own step so the drift detector can
            # inspect it independently of the call it accompanies.
            if action.get("content"):
                content = action["content"]
                add_trace(db, run_id, steps, "agent_message",
                          {"role": "assistant", "content": content, "final": False}, elapsed)
                messages.append({"role": "assistant", "content": content})

            tool_calls += 1
            name, arguments = action["tool_name"], action.get("arguments", {})
            add_trace(db, run_id, steps, "tool_call",
                      {"tool_name": name, "arguments": arguments}, elapsed)

            result_started = time.monotonic()
            result = await sandbox.call(session_id, name, arguments)
            add_trace(db, run_id, steps, "tool_result", {"tool_name": name, **result},
                      int((time.monotonic() - result_started) * 1000))
            messages += [
                {"role": "assistant", "tool_call": {"name": name, "arguments": arguments}},
                {"role": "tool", "name": name, "content": result},
            ]
        else:
            add_trace(db, run_id, steps, "error", {"reason": "execution limit exceeded"})

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
            db.add(FailureAnnotation(test_run_id=run_id, detector_version=DETECTOR_VERSION,
                                     **annotation))

        # Record which model actually served the run, so a report can show whether
        # a pool failover changed the agent under test partway through.
        served = sorted(set(getattr(adapter, "served_by", []) or []))
        if served:
            add_trace(db, run_id, steps, "meta", {"models_used": served,
                                                  "primary": getattr(adapter, "model", None)})

        outcome, score, breakdown = score_run(annotations, final_state,
                                              scenario.expected_behavior, traces)
        run.outcome, run.reliability_score, run.metrics = outcome, score, breakdown
        run.final_state, run.status, run.completed_at = final_state, "complete", now()
        run.duration_ms = int((time.monotonic() - began_run) * 1000)
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
            run.status, run.completed_at = "error", now()
            run.duration_ms = int((time.monotonic() - began_run) * 1000)
            db.add(ExecutionTrace(test_run_id=run_id, step_number=steps.current + 1,
                                  step_type="error", payload={"reason": str(exc)}))
            db.commit()
    finally:
        if session_id:
            try:
                await sandbox.close(session_id)
            except Exception:
                pass
        db.close()


SYNC_RUNS = os.getenv("SYNC_RUNS", "0") == "1"


def dispatch(background, run_id: str) -> None:
    """Queue a run, or execute it inline where background work cannot survive.

    On a normal server, BackgroundTasks runs after the response is flushed. On
    serverless the function may be frozen the moment it responds, so the run would
    never finish — there, SYNC_RUNS=1 executes it before returning instead. The
    handler is sync and lives in a threadpool worker with no running loop, so
    asyncio.run is the correct entry point.
    """
    if SYNC_RUNS:
        asyncio.run(run_test(run_id))
    else:
        background.add_task(run_test, run_id)


RUN_BUDGET_SECONDS = float(os.getenv("RUN_BUDGET_SECONDS", "20"))


def drain_pending(db, version_id: str, budget: float | None = None) -> int:
    """Execute queued runs for a version until the time budget is spent.

    Serverless caps how long one invocation may live, so a twelve-scenario suite
    cannot be guaranteed to finish inside the request that created it. Instead the
    runs are queued and drained a few at a time — including by the progress endpoint
    the dashboard already polls, so the suite finishes without any extra machinery
    and without the client needing to know it is happening.
    """
    from .models import TestRun

    budget = RUN_BUDGET_SECONDS if budget is None else budget
    version = db.get(AgentVersion, version_id)
    remote = bool(version and (version.config_snapshot or {}).get("adapter") in {"llm", "http"})
    started = time.monotonic()
    completed = 0
    while time.monotonic() - started < budget:
        db.expire_all()
        pending = (db.query(TestRun)
                     .filter_by(agent_version_id=version_id, status="pending")
                     .order_by(TestRun.id).first())
        if pending is None:
            break
        asyncio.run(run_test(pending.id))
        completed += 1
        # One slow remote scenario may use the full 45s limit. Starting another
        # would exceed Vercel's 60s invocation limit before progress can be saved.
        if remote:
            break
    return completed
