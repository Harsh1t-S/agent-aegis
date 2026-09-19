"""Small adapter for exposing an agent to Aegis one turn at a time.

Copy this module into an agent service or package the same two-field contract in
your framework. Aegis executes tools in its sandbox; the connected agent chooses
the next action and receives the mocked result on the next request.
"""
from __future__ import annotations

import hmac
import os
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


class Turn(BaseModel):
    messages: list[dict[str, Any]] = Field(default_factory=list)
    tools: dict[str, dict[str, Any]] = Field(default_factory=dict)


Action = dict[str, Any]
Handler = Callable[[list[dict[str, Any]], dict[str, dict[str, Any]]], Awaitable[Action]]


def create_runner(handler: Handler, *, token: str | None = None) -> FastAPI:
    """Create a FastAPI endpoint implementing the connected-runner contract."""
    expected = token if token is not None else os.getenv("AEGIS_RUNNER_TOKEN", "")
    app = FastAPI(title="Aegis connected-agent runner", docs_url=None, redoc_url=None)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.post("/aegis/action")
    async def next_action(turn: Turn, authorization: str = Header(default="")):
        if expected:
            supplied = authorization.removeprefix("Bearer ").strip()
            if not hmac.compare_digest(expected, supplied):
                raise HTTPException(401, "Invalid runner token")
        action = await handler(turn.messages, turn.tools)
        kind = action.get("type")
        if kind == "final" and isinstance(action.get("content"), str):
            return action
        if (kind == "tool_call" and isinstance(action.get("tool_name"), str)
                and isinstance(action.get("arguments", {}), dict)):
            return action
        raise HTTPException(
            502,
            "Agent handler must return a final message or one tool call",
        )

    return app
