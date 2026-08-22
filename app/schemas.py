from pydantic import BaseModel, Field


class AgentIn(BaseModel):
    name: str
    description: str = ""
    endpoint_config: dict = Field(default_factory=dict)
    system_prompt: str = ""
    tool_schema: dict = Field(default_factory=dict)


class VersionIn(BaseModel):
    version_label: str
    config_snapshot: dict


class EnvironmentIn(BaseModel):
    name: str
    tool_definitions: dict
    initial_state: dict = Field(default_factory=dict)
    injected_content: dict = Field(default_factory=dict)


class ScenarioIn(BaseModel):
    name: str
    category: str = "realistic"
    subtype: str = "general"
    initial_prompt: str
    expected_behavior: dict = Field(default_factory=dict)
    mock_environment_id: str
    difficulty: int = 1


class RunIn(BaseModel):
    scenario_ids: list[str] = Field(default_factory=list)
    seed: int = 0
    all_scenarios: bool = False   # run every scenario in the agent's generated suite


class IntrospectIn(BaseModel):
    """Optional overrides; falls back to whatever is stored on the agent."""
    system_prompt: str | None = None
    tool_schema: dict | None = None
    domain: str | None = None


class GenerateSuiteIn(BaseModel):
    per_category: int = 3
    seed: int = 0
    environment_name: str = "generated-sandbox"
    system_prompt: str | None = None
    tool_schema: dict | None = None
