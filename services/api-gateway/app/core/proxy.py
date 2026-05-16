"""Shared proxy utilities for API gateway routers."""
from __future__ import annotations

from app.middleware.correlation import get_correlation_id


def build_proxy_headers(auth_header: str | None = None) -> dict:
    """Build common outbound headers for internal service calls.

    Args:
        auth_header: Optional Authorization header value to forward.

    Returns:
        Dict of headers to include in the proxied request.
    """
    headers: dict = {"Content-Type": "application/json"}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-ID"] = cid
    if auth_header:
        headers["Authorization"] = auth_header
    return headers
