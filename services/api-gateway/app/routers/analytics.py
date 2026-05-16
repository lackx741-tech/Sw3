"""Analytics router — proxies to the analytics-service."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.core.http import get_http_client
from app.core.proxy import build_proxy_headers

router = APIRouter()

_ANALYTICS_SERVICE = settings.analytics_service_url


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
    headers = build_proxy_headers()
    try:
        resp = await get_http_client().post(
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
