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


_JSON_TYPES = {
    "string": str, "number": (int, float), "integer": int,
    "boolean": bool, "array": list, "object": dict,
}


def validate_arguments(definition: dict, arguments: dict | None) -> str | None:
    """Reject a call the declared schema would not accept.

    The sandbox used to accept anything, so issue_refund(amount=-5000) or a call
    with the argument missing entirely came back ok=True and the agent was told
    its malformed call had worked. A mock that never says no cannot test whether
    an agent uses its tools correctly.
    """
    schema = (definition or {}).get("parameters") or {}
    properties = schema.get("properties") or {}
    arguments = arguments or {}

    missing = [name for name in schema.get("required", []) if name not in arguments]
    if missing:
        return "missing required argument(s): %s" % ", ".join(missing)

    for name, value in arguments.items():
        spec = properties.get(name)
        if not isinstance(spec, dict):
            continue
        expected = _JSON_TYPES.get(str(spec.get("type", "")))
        # bool is a subclass of int in Python; a boolean is not a number here.
        if expected and (isinstance(value, bool) != (expected is bool)
                         or not isinstance(value, expected)):
            return "argument '%s' must be %s, got %s" % (
                name, spec.get("type"), type(value).__name__)
        if expected in ((int, float), int) and isinstance(value, (int, float)):
            if any(word in name.lower() for word in ("amount", "total", "price", "qty",
                                                     "quantity", "count")) and value < 0:
                return "argument '%s' must not be negative (got %s)" % (name, value)
    return None


# The record the generated sandbox is built around. A lookup for anything else has
# to miss, or the "returns nothing at all" scenario is unrunnable.
KNOWN_RECORD = "ORD-4471"
_ID_HINTS = ("id", "number", "ref", "record")


def _respond(template: dict, arguments: dict | None) -> dict:
    """Answer about the record that was actually asked for.

    The template was returned verbatim whatever the call said, so looking up
    ZZ-000000 came back as ORD-4471, found=true, refund_eligible=true. The agent
    then reported those values accurately and was marked for hallucinating them —
    the sandbox invented the data, not the agent.
    """
    response = copy.deepcopy(template or {"message": "ok"})
    if not isinstance(response, dict):
        return response
    arguments = arguments or {}
    requested = next((str(value) for key, value in arguments.items()
                      if any(hint in key.lower() for hint in _ID_HINTS)
                      and isinstance(value, (str, int))), None)
    if requested is None:
        return response

    identifier = next((key for key in response
                       if any(hint in key.lower() for hint in _ID_HINTS)), None)
    if identifier:
        response[identifier] = requested
    if "found" in response and requested != KNOWN_RECORD:
        # Unknown record: report the miss instead of someone else's data.
        return {identifier or "record_id": requested, "found": False,
                "message": f"No record matching {requested}."}
    return response


def call_tool(session_id: str, tool_name: str, arguments: dict | None = None) -> dict:
    session = SESSIONS.get(session_id)
    if session is None:
        return {"ok": False, "error": "Unknown or expired mock session"}

    definition = session["tools"].get(tool_name)
    if not definition:
        return {"ok": False, "error": f"Mock tool '{tool_name}' is unavailable"}

    seen = session["calls"].get(tool_name, 0) + 1
    session["calls"][tool_name] = seen

    invalid = validate_arguments(definition, arguments)
    if invalid:
        # Rejected before any state change: a call the schema forbids must not be
        # able to mutate the world the detectors grade against.
        return {"ok": False, "error": "%s rejected the call: %s" % (tool_name, invalid),
                "call_number": seen, "invalid_arguments": True}

    if definition.get("error"):
        return {"ok": False, "error": definition["error"], "call_number": seen}
    if seen <= int(definition.get("fail_times", 0)):
        return {"ok": False, "error": f"{tool_name} temporarily unavailable, try again",
                "call_number": seen}

    response_template = definition.get("response", {"message": "ok"})
    mutation = definition.get("set_state")
    if mutation:
        set_path(session["state"], mutation["path"], mutation.get("value"))
    response = _respond(response_template, arguments)
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
