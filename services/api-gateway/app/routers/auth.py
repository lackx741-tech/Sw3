from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from app.core.config import settings

router = APIRouter()

_client = httpx.AsyncClient(timeout=10.0)


async def _proxy_to_auth(
    method: str,
    path: str,
    request: Request | None = None,
    json_body: dict | None = None,
) -> dict:
    url = f"{settings.auth_service_url}{path}"
    headers = {"Content-Type": "application/json"}
    try:
        if method == "POST":
            resp = await _client.post(url, json=json_body or {}, headers=headers)
        else:
            resp = await _client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Auth service unavailable: {exc}") from exc


@router.post("/nonce")
async def get_nonce(request: Request) -> dict:
    """Proxy nonce request to auth-service."""
    body = await request.json()
    return await _proxy_to_auth("POST", "/v1/auth/nonce", request, body)


@router.post("/verify")
async def verify_siwe(request: Request) -> dict:
    """Proxy SIWE verification to auth-service."""
    body = await request.json()
    return await _proxy_to_auth("POST", "/v1/auth/verify", request, body)


@router.post("/refresh")
async def refresh_token(request: Request) -> dict:
    """Proxy token refresh to auth-service."""
    body = await request.json()
    return await _proxy_to_auth("POST", "/v1/auth/refresh", request, body)


@router.post("/logout")
async def logout(request: Request) -> dict:
    """Proxy logout to auth-service."""
    body: dict = {}
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        pass
    return await _proxy_to_auth("POST", "/v1/auth/logout", request, body)
