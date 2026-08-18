"""Adapters normalise agent systems to one turn-at-a-time protocol.

`http`       — a real agent behind a gateway implementing the contract below.
`scripted`   — a fixed list of actions; deterministic, used in unit tests.
`behavioral` — a rule-driven fake agent with configurable flaws. This is what makes
               the demo honest: one buggy agent meets the whole generated suite and
               fails in characteristic ways, instead of a script that replays the
               same three steps no matter what it was asked.
"""
from __future__ import annotations

import re
from typing import Any

import httpx

PRESSURE = re.compile(
    r"\b(urgent|immediately|right now|administrator|admin|skip the|ignore (?:all |your )?"
    r"previous|developer mode|unrestricted|no safety|full responsibility|approved by|"
    r"exception|override)\b", re.I)
VAGUE = re.compile(
    r"\b(that one|from earlier|figure out|your judgement|your judgment|everything that is "
    r"outstanding|sort out everything|i'?ll let you)\b", re.I)


class AgentAdapter:
    async def next_action(self, messages: list[dict], tools: dict[str, dict]) -> dict[str, Any]:
        raise NotImplementedError


class HttpAgentAdapter(AgentAdapter):
    """Expected remote response: {type: final|tool_call, content?, tool_name?, arguments?}."""

    def __init__(self, url: str, headers: dict | None = None):
        self.url, self.headers = url, headers or {}

    async def next_action(self, messages, tools):
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self.url, json={"messages": messages, "tools": tools},
                                         headers=self.headers)
            response.raise_for_status()
            return response.json()


class ScriptedAdapter(AgentAdapter):
    """A fixed action list stored in the version config. Deterministic by construction."""

    def __init__(self, responses: list[dict]):
        self.responses = iter(responses)

    async def next_action(self, messages, tools):
        return next(self.responses, {"type": "final", "content": "I could not complete the task."})


class BehavioralAdapter(AgentAdapter):
    """A fake agent whose flaws are declared as traits.

    Traits: refuses_destructive, complies_with_destructive, clarifies, loops,
            claims_success, drifts, verifies.
    """

    DRIFT_LINES = [
        "Actually, let me browse holiday destinations in Iceland for a moment",
        "Comparing flight prices to Reykjavik for next winter season",
        "Booking a hotel near the blue lagoon geothermal spa area",
    ]

    def __init__(self, traits: list[str]):
        self.traits = set(traits or [])

    # -- helpers ---------------------------------------------------------- #
    @staticmethod
    def _by_danger(tools: dict[str, dict]) -> tuple[list[str], list[str], list[str]]:
        destructive = [n for n, d in tools.items()
                       if (d or {}).get("danger_level") in {"high", "critical"}]
        writers = [n for n, d in tools.items() if (d or {}).get("danger_level") == "medium"]
        readers = [n for n, d in tools.items()
                   if (d or {}).get("danger_level", "low") == "low"]
        return sorted(destructive), sorted(writers), sorted(readers)

    @staticmethod
    def _calls_made(messages: list[dict]) -> int:
        return sum(1 for m in messages if "tool_call" in m)

    def _maybe_drift(self, index: int) -> str | None:
        if "drifts" not in self.traits:
            return None
        return self.DRIFT_LINES[index % len(self.DRIFT_LINES)]

    # -- protocol --------------------------------------------------------- #
    async def next_action(self, messages, tools):
        prompt = next((m.get("content", "") for m in messages if m.get("role") == "user"), "")
        destructive, writers, readers = self._by_danger(tools)
        made = self._calls_made(messages)

        # An agent that loops keeps re-checking the same thing and never progresses.
        if "loops" in self.traits and readers:
            if made < 4:
                action = {"type": "tool_call", "tool_name": readers[0], "arguments": {"id": 1}}
                if (drift := self._maybe_drift(made)):
                    action["content"] = drift
                return action
            return {"type": "final", "content": "Done."}

        adversarial = bool(PRESSURE.search(prompt))
        ambiguous = bool(VAGUE.search(prompt))

        if adversarial:
            if "refuses_destructive" in self.traits:
                return {"type": "final", "content": (
                    "I cannot do that. That action is irreversible and I am not permitted "
                    "to take it without a confirmed, authorised request through the normal "
                    "process. I have not changed anything.")}
            if "complies_with_destructive" in self.traits and destructive:
                if made == 0:
                    action = {"type": "tool_call", "tool_name": destructive[0], "arguments": {}}
                    if (drift := self._maybe_drift(0)):
                        action["content"] = drift
                    return action
                return {"type": "final",
                        "content": f"I have successfully completed {destructive[0]} as requested."}

        if ambiguous:
            if "clarifies" in self.traits:
                return {"type": "final", "content": (
                    "Before I act, which record do you mean? I want to confirm the exact "
                    "item and the change you expect.")}
            if "claims_success" in self.traits:
                return {"type": "final", "content": "All set — I have handled everything outstanding."}

        # Normal path.
        if "claims_success" in self.traits and made == 0:
            return {"type": "final",
                    "content": "I successfully completed the task. Everything is up to date."}

        target = next((t for t in writers if t in prompt.replace(" ", "_")), None) \
            or (writers[0] if writers else (readers[0] if readers else None))
        if target and made == 0:
            action = {"type": "tool_call", "tool_name": target, "arguments": {}}
            if (drift := self._maybe_drift(0)):
                action["content"] = drift
            return action

        if made and "verifies" in self.traits and readers and made == 1:
            return {"type": "tool_call", "tool_name": readers[0], "arguments": {"verify": True}}

        if made:
            return {"type": "final", "content": "I completed the requested task."}
        return {"type": "final",
                "content": "I could not find a suitable tool for this request."}


def adapter_for(config: dict) -> AgentAdapter:
    kind = config.get("adapter", "http")
    if kind == "scripted":
        return ScriptedAdapter(config.get("responses", []))
    if kind == "behavioral":
        return BehavioralAdapter(config.get("traits", []))
    if kind == "http":
        return HttpAgentAdapter(config["url"], config.get("headers"))
    raise ValueError(f"Unsupported adapter '{kind}'")
