import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    # Naive UTC keeps parity with existing rows; utcnow() is deprecated on 3.12+.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    endpoint_config: Mapped[dict] = mapped_column(JSON, default=dict)
    # Introspection inputs and the cached profile derived from them.
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    tool_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    profile: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AgentVersion(Base):
    __tablename__ = "agent_versions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    version_label: Mapped[str] = mapped_column(String(100))
    config_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class MockEnvironment(Base):
    __tablename__ = "mock_environments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200))
    tool_definitions: Mapped[dict] = mapped_column(JSON, default=dict)
    initial_state: Mapped[dict] = mapped_column(JSON, default=dict)
    injected_content: Mapped[dict] = mapped_column(JSON, default=dict)


class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(50), default="realistic")
    subtype: Mapped[str] = mapped_column(String(100), default="general")
    initial_prompt: Mapped[str] = mapped_column(Text)
    expected_behavior: Mapped[dict] = mapped_column(JSON, default=dict)
    mock_environment_id: Mapped[str] = mapped_column(ForeignKey("mock_environments.id"))
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    generator_version: Mapped[str] = mapped_column(String(50), default="manual")
    # Injection payloads belong to the scenario that tests them. Held on the
    # environment they leaked into every other scenario sharing the same sandbox.
    injected_content: Mapped[dict] = mapped_column(JSON, default=dict)


class TestRun(Base):
    __tablename__ = "test_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    agent_version_id: Mapped[str] = mapped_column(ForeignKey("agent_versions.id"), index=True)
    scenario_id: Mapped[str] = mapped_column(ForeignKey("scenarios.id"), index=True)
    replayed_from_run_id: Mapped[str | None] = mapped_column(ForeignKey("test_runs.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    seed: Mapped[int] = mapped_column(Integer, default=0)
    outcome: Mapped[str | None] = mapped_column(String(10), nullable=True)
    reliability_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Per-metric breakdown so the dashboard never recomputes from raw traces.
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    final_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)


class ExecutionTrace(Base):
    __tablename__ = "execution_traces"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    test_run_id: Mapped[str] = mapped_column(ForeignKey("test_runs.id"), index=True)
    step_number: Mapped[int] = mapped_column(Integer)
    step_type: Mapped[str] = mapped_column(String(30))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=now)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)


class FailureAnnotation(Base):
    __tablename__ = "failure_annotations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    test_run_id: Mapped[str] = mapped_column(ForeignKey("test_runs.id"), index=True)
    failure_type: Mapped[str] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(20))
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    detector_version: Mapped[str] = mapped_column(String(50), default="rules-v2")
