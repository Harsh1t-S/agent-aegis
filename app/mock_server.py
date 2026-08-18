"""HTTP wrapper around the mock sandbox.

Runs as its own process so an agent under test can never reach a real credential
even if it tries. The logic lives in `mock_core`; this file is transport only, and
the serverless deployment imports that core directly instead.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from . import mock_core

app = FastAPI(title="Aegis Mock Tools")


class StartSession(BaseModel):
    tools: dict[str, dict]
    initial_state: dict = {}
    injected_content: dict = {}
    seed: int = 0


class ToolCall(BaseModel):
    arguments: dict = {}


@app.post("/sessions")
def start_session(body: StartSession):
    session_id = mock_core.start_session(body.tools, body.initial_state,
                                         body.injected_content, body.seed)
    return {"session_id": session_id}


@app.post("/sessions/{session_id}/tools/{tool_name}")
def call_tool(session_id: str, tool_name: str, body: ToolCall):
    if session_id not in mock_core.SESSIONS:
        raise HTTPException(404, "Unknown or expired mock session")
    return mock_core.call_tool(session_id, tool_name, body.arguments)


@app.get("/sessions/{session_id}/state")
def session_state(session_id: str):
    if session_id not in mock_core.SESSIONS:
        raise HTTPException(404, "Unknown or expired mock session")
    return mock_core.session_state(session_id)


@app.delete("/sessions/{session_id}")
def close_session(session_id: str):
    return mock_core.close_session(session_id)


@app.get("/health")
def health():
    return {"status": "ok", "active_sessions": len(mock_core.SESSIONS)}
