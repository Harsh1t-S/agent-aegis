"""Mock tool sandbox — the logic, independent of transport.

Split out of `mock_server.py` so the same code can run two ways:

* **out of process** (local, Docker) — a separate HTTP service that never holds
  credentials for real tools, which is the stronger isolation story;
* **in process** (serverless) — imported directly, because a platform that gives
  you one short-lived function per request cannot host a second long-running
  service, and an HTTP hop to yourself is just latency.

Both paths execute identical code, so a scenario grades the same either way.
"""
from __future__ import annotations

import copy
import random
import uuid
from typing import Any

# Session id -> sandbox state. Process-local by design: a sandbox must not outlive
# the run it belongs to.
SESSIONS: dict[str, dict[str, Any]] = {}


def set_path(state: dict, path: str, value: Any) -> None:
    cursor = state
    bits = path.split(".")
    for bit in bits[:-1]:
        cursor = cursor.setdefault(bit, {})
    cursor[bits[-1]] = value


def start_session(tools: dict, initial_state: dict | None = None,
                  injected_content: dict | None = None, seed: int = 0) -> str:
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "tools": copy.deepcopy(tools or {}),
        "state": copy.deepcopy(initial_state or {}),
        "injected": copy.deepcopy(injected_content or {}),
        "calls": {},
        "rng": random.Random(seed),
    }
    return session_id


def call_tool(session_id: str, tool_name: str, arguments: dict | None = None) -> dict:
    session = SESSIONS.get(session_id)
    if session is None:
        return {"ok": False, "error": "Unknown or expired mock session"}

    definition = session["tools"].get(tool_name)
    if not definition:
        return {"ok": False, "error": f"Mock tool '{tool_name}' is unavailable"}

    seen = session["calls"].get(tool_name, 0) + 1
    session["calls"][tool_name] = seen

    if definition.get("error"):
        return {"ok": False, "error": definition["error"], "call_number": seen}
    if seen <= int(definition.get("fail_times", 0)):
        return {"ok": False, "error": f"{tool_name} temporarily unavailable, try again",
                "call_number": seen}

    mutation = definition.get("set_state")
    if mutation:
        set_path(session["state"], mutation["path"], mutation.get("value"))
    response = copy.deepcopy(definition.get("response", {"message": "ok"}))
    if tool_name in session["injected"]:
        # Third-party content. A well-behaved agent treats this as data, not orders.
        response["untrusted_content"] = session["injected"][tool_name]
    return {"ok": True, "result": response, "state_changed": bool(mutation),
            "call_number": seen}


def session_state(session_id: str) -> dict:
    session = SESSIONS.get(session_id)
    if session is None:
        return {"state": {}, "call_counts": {}}
    return {"state": session["state"], "call_counts": session["calls"]}


def close_session(session_id: str) -> dict:
    SESSIONS.pop(session_id, None)
    return {"closed": True}
