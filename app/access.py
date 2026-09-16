"""Owner authorization for mutations and requests that execute queued work."""
import hmac
import os

from fastapi import Request


def access_state(request: Request) -> dict:
    expected = os.getenv("AEGIS_ADMIN_KEY", "").strip()
    required = bool(expected or os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
                    or os.getenv("SERVERLESS") == "1" or os.getenv("AEGIS_REQUIRE_AUTH") == "1")
    scheme, _, supplied = request.headers.get("authorization", "").partition(" ")
    authorized = not required or bool(expected and scheme.lower() == "bearer" and
                                      hmac.compare_digest(supplied.encode(), expected.encode()))
    return {"required": required, "configured": bool(expected), "authorized": authorized}


def can_write(request: Request) -> bool:
    return access_state(request)["authorized"]
