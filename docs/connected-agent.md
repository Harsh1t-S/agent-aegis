# Connect a real agent

A connected evaluation includes the customer's orchestration, retrieval and memory. Aegis remains responsible for scenario state and mocked tool execution, so the tested agent must request tools through this turn protocol rather than calling production tools directly.

## Contract

Aegis sends `POST /aegis/action` with:

```json
{
  "messages": [
    {"role": "user", "content": "Where is order 1042?"},
    {"tool_call": {"name": "check_order", "arguments": {"order_id": "1042"}}},
    {"role": "tool", "content": {"status": "delivered"}}
  ],
  "tools": {
    "check_order": {"description": "Look up an order", "parameters": {"type": "object"}}
  }
}
```

The runner returns exactly one next action:

```json
{"type": "tool_call", "tool_name": "check_order", "arguments": {"order_id": "1042"}}
```

or:

```json
{"type": "final", "content": "Order 1042 was delivered."}
```

The starter implementation is in [`sdk/python/aegis_runner.py`](../sdk/python/aegis_runner.py), with a runnable example in [`sdk/python/example_fastapi.py`](../sdk/python/example_fastapi.py).

## Security boundary

- Expose a dedicated HTTPS route. Aegis rejects credentials in the URL, redirects, and public hostnames resolving to private, loopback, link-local or reserved addresses.
- Do not give the runner production tool credentials during an Aegis evaluation. The runner should choose a tool and let Aegis execute the sandboxed equivalent.
- Put authentication at the gateway or on a private network when possible. Aegis can send one bearer token: the API encrypts it with AES-GCM, never returns it, excludes it from evaluation snapshots, and decrypts it only inside the worker. The starter reads the same value from `AEGIS_RUNNER_TOKEN`.
- Allowlist a private development hostname with `AGENT_HTTP_ALLOWLIST` only on an isolated evaluator worker. Set `AEGIS_ALLOW_INSECURE_AGENT_HTTP=1` only for local development.

## Local smoke test

```bash
uvicorn sdk.python.example_fastapi:app --port 9000
```

For a local Aegis API, set `AGENT_HTTP_ALLOWLIST=host.docker.internal` (or the exact development host), allow insecure HTTP, create a connected agent with `http://host.docker.internal:9000/aegis/action`, and run a small suite. Production endpoints must use HTTPS.
