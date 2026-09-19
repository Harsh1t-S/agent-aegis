"""Authentication for browser sessions and workspace API keys."""
from __future__ import annotations

import hashlib
import hmac
import os
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache

import httpx
import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

from .database import SessionLocal, set_session_context
from .models import LOCAL_USER_ID, WorkspaceApiKey, now


@dataclass(frozen=True)
class Principal:
    user_id: str
    email: str = ""
    auth_type: str = "user"
    workspace_id: str | None = None
    scopes: tuple[str, ...] = ()


def auth_disabled() -> bool:
    hosted = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
                  or os.getenv("SERVERLESS") == "1")
    # A copied local .env must never turn a hosted deployment into a shared,
    # unauthenticated workspace. Hosted runtimes always require identity.
    if hosted:
        return False
    explicit = os.getenv("AEGIS_AUTH_DISABLED")
    if explicit is not None:
        return explicit == "1"
    return not os.getenv("SUPABASE_URL")


def token_hash(token: str) -> str:
    pepper = os.getenv("AEGIS_API_KEY_PEPPER", "")
    return hashlib.sha256(f"{pepper}:{token}".encode()).hexdigest()


@lru_cache(maxsize=2)
def _jwk_client(url: str) -> PyJWKClient:
    # PyJWKClient caches the key set. Supabase's endpoint also has a ten-minute
    # edge cache, so retaining it for the process lifetime does not create a
    # stronger revocation delay than the upstream source.
    return PyJWKClient(f"{url.rstrip('/')}/auth/v1/.well-known/jwks.json",
                       cache_keys=True, lifespan=600)


def _verify_legacy_token(token: str, supabase_url: str) -> dict:
    publishable = (os.getenv("SUPABASE_PUBLISHABLE_KEY")
                   or os.getenv("SUPABASE_ANON_KEY", ""))
    if not publishable:
        raise HTTPException(503, "Supabase publishable key is not configured")
    try:
        response = httpx.get(
            f"{supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": publishable, "Authorization": f"Bearer {token}"},
            timeout=8,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Identity provider is temporarily unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(401, "Session is invalid or expired")
    user = response.json()
    return {"sub": user.get("id"), "email": user.get("email", ""),
            "role": "authenticated"}


def _verify_supabase_token(token: str) -> dict:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    if not supabase_url:
        raise HTTPException(503, "SUPABASE_URL is not configured")
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Malformed session token") from exc

    algorithm = header.get("alg", "")
    if algorithm == "HS256":
        # Supabase recommends checking legacy shared-secret tokens with Auth
        # rather than copying the signing secret into each application.
        return _verify_legacy_token(token, supabase_url)
    if algorithm not in {"RS256", "ES256", "EdDSA"}:
        raise HTTPException(401, "Unsupported session signing algorithm")

    try:
        signing_key = _jwk_client(supabase_url).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=[algorithm],
            audience=os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated"),
            issuer=f"{supabase_url}/auth/v1",
            leeway=30,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Session is invalid or expired") from exc


def _authenticate_api_key(token: str) -> Principal:
    hashed = token_hash(token)
    db = SessionLocal()
    try:
        # The key hash determines the workspace, so lookup must happen before a
        # tenant context exists. Worker context is limited to this authentication
        # session; the request's normal DB session is scoped immediately after.
        set_session_context(db, worker=True)
        record = db.query(WorkspaceApiKey).filter_by(secret_hash=hashed).first()
        if not record or record.revoked_at:
            raise HTTPException(401, "API key is invalid")
        if record.expires_at and record.expires_at <= now():
            raise HTTPException(401, "API key has expired")
        # A hash comparison makes the final equality check constant-time even
        # though the indexed lookup already narrowed the result.
        if not hmac.compare_digest(record.secret_hash, hashed):
            raise HTTPException(401, "API key is invalid")
        record.last_used_at = now()
        db.commit()
        return Principal(
            user_id=record.created_by,
            auth_type="api_key",
            workspace_id=record.workspace_id,
            scopes=tuple(record.scopes or ()),
        )
    finally:
        db.close()


def authenticate_request(request: Request) -> Principal:
    if auth_disabled():
        return Principal(user_id=LOCAL_USER_ID, email="local@aegis.invalid",
                         auth_type="local")

    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Sign in to access this workspace")
    if token.startswith("aegis_"):
        return _authenticate_api_key(token)

    claims = _verify_supabase_token(token)
    subject = str(claims.get("sub") or "")
    if not subject or claims.get("role") not in {"authenticated", "service_role"}:
        raise HTTPException(401, "Session does not identify an authenticated user")
    return Principal(user_id=subject, email=str(claims.get("email") or ""))


def require_api_key_scope(request: Request, principal: Principal) -> None:
    """Apply least-privilege scopes to machine credentials.

    User sessions continue through the workspace role checks in each endpoint.
    API keys are intended for CI and integrations, so a read-only key must never
    inherit the role of the person who created it.
    """
    if principal.auth_type != "api_key":
        return
    path = request.url.path
    method = request.method.upper()
    if method in {"GET", "HEAD"}:
        required = "read"
    elif (
        path.endswith("/evaluate")
        or "/rerun" in path
        or "/guardrail" in path
        or path.endswith("/cancel")
    ):
        required = "evaluate"
    else:
        required = "admin"
    scopes = set(principal.scopes)
    if required == "read" and scopes.intersection({"read", "evaluate", "admin"}):
        return
    if required == "evaluate" and scopes.intersection({"evaluate", "admin"}):
        return
    if required == "admin" and "admin" in scopes:
        return
    raise HTTPException(403, f"This API key does not have the {required} scope")


def principal_from_request(request: Request) -> Principal:
    principal = getattr(request.state, "principal", None)
    if not principal:
        raise HTTPException(401, "Sign in to access this workspace")
    return principal
