"""Simulation router — proxies transaction simulation to the Rust simulation-engine."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.middleware.correlation import get_correlation_id

router = APIRouter()

_client = httpx.AsyncClient(timeout=30.0)

_SIMULATION_ENGINE = settings.simulation_engine_url


@router.post("/")
async def simulate_transaction(request: Request) -> dict:
    """Simulate a transaction via the simulation engine.

    Request body: {"from": "0x...", "to": "0x...", "data": "0x...", "value": "0x0"}
    Response:     {"success": bool, "gas_estimate": int, "revert_reason": str|null}
    """
    body = await request.json()
    headers: dict = {"Content-Type": "application/json"}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-ID"] = cid
    try:
        resp = await _client.post(
            f"{_SIMULATION_ENGINE}/simulate",
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
            status_code=503, detail=f"Simulation engine unavailable: {exc}"
        ) from exc
