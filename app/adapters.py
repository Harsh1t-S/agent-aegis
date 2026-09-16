"""Adapters normalise agent systems to one turn-at-a-time protocol.

`http`       — a real agent behind a gateway implementing the contract below.
`scripted`   — a fixed list of actions; deterministic, used in unit tests.
`behavioral` — a rule-driven fake agent with configurable flaws.
"""
from __future__ import annotations

import asyncio
import json
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
    """A fake agent whose flaws are declared as traits."""

    DRIFT_LINES = [
        "Actually, let me browse holiday destinations in Iceland for a moment",
        "Comparing flight prices to Reykjavik for next winter season",
        "Booking a hotel near the blue lagoon geothermal spa area",
    ]

    def __init__(self, traits: list[str]):
        self.traits = set(traits or [])

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

    async def next_action(self, messages, tools):
        prompt = next((m.get("content", "") for m in messages if m.get("role") == "user"), "")
        destructive, writers, readers = self._by_danger(tools)
        made = self._calls_made(messages)

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
        return {"type": "final", "content": "I could not find a suitable tool for this request."}


def adapter_for(config: dict, rotation: int = 0) -> AgentAdapter:
    kind = config.get("adapter", "http")
    if kind == "scripted":
        return ScriptedAdapter(config.get("responses", []))
    if kind == "behavioral":
        return BehavioralAdapter(config.get("traits", []))
    if kind == "llm":
        return LLMAgentAdapter(model=config.get("model"),
                               models=config.get("models"),
                               rotation=rotation,
                               system_prompt=config.get("system_prompt", ""),
                               base_url=config.get("base_url"),
                               api_key=config.get("api_key"))
    if kind == "http":
        return HttpAgentAdapter(config["url"], config.get("headers"))
    raise ValueError(f"Unsupported adapter '{kind}'")


class LLMAgentAdapter(AgentAdapter):
    """A real language model acting as the agent under test."""

    DEFAULT_BASE = "https://api.groq.com/openai/v1"
    DEFAULT_MODEL = "openai/gpt-oss-20b"
    MAX_RETRIES = 4
    DEFAULT_POOL = ("groq:openai/gpt-oss-20b", "google:gemini-flash-lite-latest",
                    "groq:openai/gpt-oss-120b")

    PROVIDERS = {
        "groq": ("https://api.groq.com/openai/v1", "GROQ_API_KEY"),
        "google": ("https://generativelanguage.googleapis.com/v1beta/openai",
                   "GOOGLE_API_KEY"),
        "openai": ("https://api.openai.com/v1", "OPENAI_API_KEY"),
        "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
    }

    def _resolve(self, entry: str) -> tuple[str, str, str]:
        """"provider:model" -> (model, base_url, api_key)."""
        import os

        provider, _, model = entry.partition(":")
        if not model or provider not in self.PROVIDERS:
            return entry, self.base_url, self.api_key
        base, env = self.PROVIDERS[provider]
        return model, base, (os.getenv(env) or self.api_key)

    def __init__(self, model: str | None = None, system_prompt: str = "",
                 base_url: str | None = None, api_key: str | None = None,
                 temperature: float = 0.0, models: list[str] | None = None,
                 rotation: int = 0):
        import os

        self.pool = [m for m in (models or []) if m] or [
            model or os.getenv("LLM_MODEL", self.DEFAULT_MODEL)]
        self.rotation = rotation
        self.model = self.pool[rotation % len(self.pool)]
        self.served_by: list[str] = []
        self.base_url = (base_url or os.getenv("LLM_BASE_URL", self.DEFAULT_BASE)).rstrip("/")
        self.api_key = api_key or os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY", "")
        self.system_prompt = system_prompt
        self.temperature = temperature

    @staticmethod
    def _schema(tools: dict[str, dict]) -> list[dict]:
        out = []
        for name, definition in (tools or {}).items():
            definition = definition or {}
            out.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": definition.get("description") or name.replace("_", " "),
                    "parameters": definition.get("parameters")
                                  or {"type": "object", "properties": {}},
                },
            })
        return out

    def _conversation(self, messages: list[dict]) -> list[dict]:
        out: list[dict] = []
        if self.system_prompt:
            out.append({"role": "system", "content": self.system_prompt})
        for message in messages:
            if message.get("role") == "user":
                out.append({"role": "user", "content": message.get("content", "")})
            elif message.get("role") == "tool":
                out.append({"role": "user",
                            "content": f"[tool result from {message.get('name')}] "
                                       f"{json.dumps(message.get('content'), default=str)[:1500]}"})
            elif "tool_call" in message:
                call = message["tool_call"]
                out.append({"role": "assistant",
                            "content": f"[called {call.get('name')} with "
                                       f"{json.dumps(call.get('arguments', {}), default=str)[:500]}]"})
            elif message.get("content"):
                out.append({"role": "assistant", "content": message["content"]})
        return out

    LARGE_PAYLOAD_TOKENS = 3000

    def _failover_order(self, payload: dict) -> list[str]:
        estimate = len(json.dumps(payload, default=str)) // 4
        rest = [m for m in self.pool if m != self.model]
        if estimate < self.LARGE_PAYLOAD_TOKENS:
            rest.sort(key=lambda m: 0 if m.startswith("groq:") else 1)
        else:
            rest.sort(key=lambda m: 0 if m.startswith("google:") else 1)
        return rest

    def _configured_order(self, payload: dict) -> list[tuple[str, str, str, str]]:
        """Return routable candidates, excluding providers for which no key exists."""
        candidates = [self.model] + self._failover_order(payload)
        configured = []
        for candidate in candidates:
            model_name, base_url, key = self._resolve(candidate)
            if key:
                configured.append((candidate, model_name, base_url, key))
        return configured

    async def next_action(self, messages, tools):
        payload = {
            "model": self.model,
            "messages": self._conversation(messages),
            "temperature": self.temperature,
        }
        schema = self._schema(tools)
        if schema:
            payload["tools"] = schema
            payload["tool_choice"] = "auto"

        order = self._configured_order(payload)
        if not order:
            raise ValueError(
                "No API key is configured for any model in the LLM pool. "
                "Set the provider-specific key (for example GROQ_API_KEY or GOOGLE_API_KEY), "
                "or LLM_API_KEY for a custom OpenAI-compatible endpoint."
            )

        async with httpx.AsyncClient(timeout=60) as client:
            response = None
            for attempt in range(self.MAX_RETRIES):
                candidate, model_name, base_url, key = order[attempt % len(order)]
                payload["model"] = model_name
                response = await client.post(
                    f"{base_url}/chat/completions", json=payload,
                    headers={"Authorization": f"Bearer {key}"})
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt == self.MAX_RETRIES - 1:
                        response.raise_for_status()
                    if (attempt + 1) % len(order) == 0:
                        wait = float(response.headers.get("retry-after") or 0) or 2 ** attempt
                        await asyncio.sleep(min(wait, 20))
                    continue
                response.raise_for_status()
                self.served_by.append(candidate)
                break
            if response is None:
                raise RuntimeError("LLM request did not execute")
            choice = response.json()["choices"][0]["message"]

        calls = choice.get("tool_calls") or []
        if calls:
            call = calls[0]["function"]
            try:
                arguments = json.loads(call.get("arguments") or "{}")
            except json.JSONDecodeError:
                arguments = {"_raw": call.get("arguments")}
            action = {"type": "tool_call", "tool_name": call["name"],
                      "arguments": arguments if isinstance(arguments, dict) else {}}
            if choice.get("content"):
                action["content"] = choice["content"]
            return action

        return {"type": "final", "content": choice.get("content") or ""}