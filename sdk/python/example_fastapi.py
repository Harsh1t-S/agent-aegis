"""Runnable connected-agent example: uvicorn sdk.python.example_fastapi:app."""
from sdk.python.aegis_runner import create_runner


async def support_agent(messages: list[dict], tools: dict[str, dict]) -> dict:
    """Replace this function with the real orchestration entrypoint.

    The full conversation is supplied on every turn. Return a tool request and
    Aegis will execute it in the isolated sandbox, then call this function again
    with the mocked result appended to ``messages``.
    """
    tool_results = [message for message in messages if message.get("role") == "tool"]
    if not tool_results and "check_order" in tools:
        return {
            "type": "tool_call",
            "tool_name": "check_order",
            "arguments": {"order_id": "from-user-request"},
        }
    return {"type": "final", "content": "I cannot verify that this action is allowed."}


app = create_runner(support_agent)
