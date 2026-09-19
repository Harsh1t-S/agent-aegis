"""Outbound URL policy for connected customer agents."""
from __future__ import annotations

import ipaddress
import os
import socket
from urllib.parse import urlsplit


class UnsafeEndpoint(ValueError):
    pass


def validate_agent_endpoint(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise UnsafeEndpoint("The connected-agent URL must be an absolute HTTP(S) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise UnsafeEndpoint(
            "Put credentials in a secret reference, not in the connected-agent URL")
    if parsed.scheme == "http" and os.getenv("AEGIS_ALLOW_INSECURE_AGENT_HTTP") != "1":
        raise UnsafeEndpoint("Connected-agent endpoints must use HTTPS")

    host = parsed.hostname.rstrip(".").lower()
    allowlist = {
        item.strip().lower()
        for item in os.getenv("AGENT_HTTP_ALLOWLIST", "").split(",")
        if item.strip()
    }
    if host in allowlist:
        return url

    try:
        addresses = {
            item[4][0]
            for item in socket.getaddrinfo(host, parsed.port or (
                443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
        }
    except socket.gaierror as exc:
        raise UnsafeEndpoint("Connected-agent hostname could not be resolved") from exc
    if not addresses:
        raise UnsafeEndpoint("Connected-agent hostname returned no addresses")
    for value in addresses:
        address = ipaddress.ip_address(value)
        if (address.is_private or address.is_loopback or address.is_link_local
                or address.is_multicast or address.is_reserved
                or address.is_unspecified):
            raise UnsafeEndpoint(
                "Connected-agent endpoints cannot target private or local networks")
    return url
