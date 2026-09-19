"""Encrypt small integration secrets before they reach Postgres."""
from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class SecretConfigurationError(ValueError):
    pass


def _key() -> bytes:
    value = os.getenv("AEGIS_SECRET_ENCRYPTION_KEY", "").strip()
    if not value:
        raise SecretConfigurationError(
            "Encrypted runner credentials are not configured on this deployment")
    try:
        key = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except Exception as exc:
        raise SecretConfigurationError("AEGIS_SECRET_ENCRYPTION_KEY is invalid") from exc
    if len(key) != 32:
        raise SecretConfigurationError(
            "AEGIS_SECRET_ENCRYPTION_KEY must encode exactly 32 random bytes")
    return key


def encrypt_secret(value: str, *, context: str) -> str:
    nonce = os.urandom(12)
    ciphertext = AESGCM(_key()).encrypt(nonce, value.encode(), context.encode())
    return base64.urlsafe_b64encode(nonce + ciphertext).decode().rstrip("=")


def decrypt_secret(value: str, *, context: str) -> str:
    try:
        packed = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        return AESGCM(_key()).decrypt(
            packed[:12], packed[12:], context.encode()).decode()
    except SecretConfigurationError:
        raise
    except Exception as exc:
        raise SecretConfigurationError("Runner credential could not be decrypted") from exc
