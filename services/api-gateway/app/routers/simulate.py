"""Simulation router — proxies transaction simulation to the Rust simulation-engine."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.core.http import get_http_client
from app.core.proxy import build_proxy_headers

router = APIRouter()

_SIMULATION_ENGINE = settings.simulation_engine_url


@router.post("/")
async def simulate_transaction(request: Request) -> dict:
    """Simulate a transaction via the simulation engine.

    Request body: {"from": "0x...", "to": "0x...", "data": "0x...", "value": "0x0"}
    Response:     {"success": bool, "gas_estimate": int, "revert_reason": str|null}
    """
    body = await request.json()
    headers = build_proxy_headers()
    try:
        resp = await get_http_client().post(
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
