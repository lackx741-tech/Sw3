from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.core.http import get_http_client
from app.core.proxy import build_proxy_headers

router = APIRouter()

_EXECUTION_ENGINE = settings.execution_engine_url


@router.post("/", status_code=201)
async def create_sweep_job(request: Request) -> dict:
    """Create a new sweep job via the execution engine."""
    body = await request.json()
    headers = build_proxy_headers(request.headers.get("Authorization"))
    try:
        resp = await get_http_client().post(
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
    headers = build_proxy_headers(request.headers.get("Authorization"))
    try:
        resp = await get_http_client().get(
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
