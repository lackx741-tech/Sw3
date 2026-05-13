"""Analytics router — proxies to the analytics-service."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.middleware.correlation import get_correlation_id

router = APIRouter()

_client = httpx.AsyncClient(timeout=10.0)

_ANALYTICS_SERVICE = settings.analytics_service_url


def _proxy_headers() -> dict:
    headers: dict = {"Content-Type": "application/json"}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-ID"] = cid
    return headers


@router.get("/")
async def analytics_root() -> dict:
    return {"status": "ok", "service": "analytics"}


@router.post("/events", status_code=202)
async def log_event(request: Request) -> dict:
    """Forward an analytics event to the analytics-service.

    The call is fire-and-forget from the caller's perspective: if the
    analytics service is unavailable the gateway returns 202 with a
    degraded flag rather than failing the caller.
    """
    body = await request.json()
    headers = _proxy_headers()
    try:
        resp = await _client.post(
            f"{_ANALYTICS_SERVICE}/v1/events",
            json=body,
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code, detail=exc.response.text
        ) from exc
    except httpx.RequestError:
        # Analytics is non-critical; degrade gracefully
        return {"accepted": True, "degraded": True}
