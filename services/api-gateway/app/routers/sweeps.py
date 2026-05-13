from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.middleware.correlation import get_correlation_id

router = APIRouter()

_client = httpx.AsyncClient(timeout=30.0)

_EXECUTION_ENGINE = settings.execution_engine_url


def _proxy_headers() -> dict:
    """Build common headers forwarded to the execution engine."""
    headers: dict = {"Content-Type": "application/json"}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-ID"] = cid
    return headers


@router.post("/", status_code=201)
async def create_sweep_job(request: Request) -> dict:
    """Create a new sweep job via the execution engine."""
    body = await request.json()
    headers = _proxy_headers()
    # Forward the caller's Authorization header if present
    auth_header = request.headers.get("Authorization")
    if auth_header:
        headers["Authorization"] = auth_header
    try:
        resp = await _client.post(
            f"{_EXECUTION_ENGINE}/sweep-jobs",
            json=body,
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code, detail=exc.response.text
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503, detail=f"Execution engine unavailable: {exc}"
        ) from exc


@router.get("/{job_id}")
async def get_sweep_job(job_id: str, request: Request) -> dict:
    """Retrieve a sweep job by ID via the execution engine."""
    headers = _proxy_headers()
    auth_header = request.headers.get("Authorization")
    if auth_header:
        headers["Authorization"] = auth_header
    try:
        resp = await _client.get(
            f"{_EXECUTION_ENGINE}/sweep-jobs/{job_id}",
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code, detail=exc.response.text
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503, detail=f"Execution engine unavailable: {exc}"
        ) from exc
