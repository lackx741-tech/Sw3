"""Shared async HTTP client for internal service proxying.

A single httpx.AsyncClient is shared across all proxy routers and closed
during the FastAPI application shutdown via the lifespan context manager
in main.py.
"""
from __future__ import annotations

import httpx

_http_client: httpx.AsyncClient | None = None


async def init_http_client() -> None:
    global _http_client
    _http_client = httpx.AsyncClient(timeout=30.0)


async def close_http_client() -> None:
    if _http_client is not None:
        await _http_client.aclose()


def get_http_client() -> httpx.AsyncClient:
    if _http_client is None:
        raise RuntimeError("HTTP client not initialized")
    return _http_client
