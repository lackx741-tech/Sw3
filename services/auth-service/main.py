"""SW3 Auth Service — SIWE-based authentication with JWT sessions.

Flow
----
1. Client calls ``POST /v1/auth/nonce`` with an Ethereum address.
   The server generates a cryptographically random nonce, stores it in Redis
   with a short TTL, and returns it.

2. Client builds a SIWE message, signs it, then calls ``POST /v1/auth/verify``
   with {message, signature, address}.
   The server:
     a. Parses the SIWE message.
     b. Verifies the signature.
     c. Confirms the nonce matches what was issued (replay protection: deletes
        the Redis key so it cannot be reused).
     d. Checks the message expiration time (if set).
     e. Issues a signed JWT and a refresh token.

3. Client calls ``POST /v1/auth/refresh`` with a refresh token to extend the
   session without re-signing.

4. Client calls ``POST /v1/auth/logout`` to revoke the session.

Security notes
--------------
- Nonces are single-use and expire after ``NONCE_TTL_SECONDS`` (default 5 min).
- JWTs are HS256-signed with ``JWT_SECRET`` (set this to a strong secret in
  production — min 32 random bytes).
- Refresh tokens are stored in Redis and can be revoked server-side.
"""
from __future__ import annotations

import os
import secrets
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from pydantic import BaseModel
from siwe import SiweMessage

from app.config import settings
from app.redis import close_redis, get_redis, init_redis


# ─── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # noqa: ARG001
    await init_redis()
    yield
    await close_redis()


# ─── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="SW3 Auth Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Redis key helpers ─────────────────────────────────────────────────────────

def _nonce_key(address: str) -> str:
    return f"sw3:auth:nonce:{address.lower()}"


def _refresh_key(jti: str) -> str:
    return f"sw3:auth:refresh:{jti}"


# ─── JWT helpers ───────────────────────────────────────────────────────────────

def _issue_access_token(address: str, chain_id: int, jti: str) -> str:
    now = int(time.time())
    payload = {
        "sub": address.lower(),
        "chain_id": chain_id,
        "jti": jti,
        "iat": now,
        "exp": now + settings.access_token_expire_minutes * 60,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _issue_refresh_token(address: str, jti: str) -> str:
    now = int(time.time())
    payload = {
        "sub": address.lower(),
        "jti": jti,
        "iat": now,
        "exp": now + settings.refresh_token_expire_days * 86400,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}"
        ) from exc


# ─── Request / response models ─────────────────────────────────────────────────

class NonceRequest(BaseModel):
    address: str


class NonceResponse(BaseModel):
    nonce: str
    address: str


class VerifyRequest(BaseModel):
    message: str
    signature: str
    address: str
    chain_id: int | None = None


class TokenResponse(BaseModel):
    token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    address: str
    chain_id: int | None


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "auth-service"}


@app.post("/v1/auth/nonce", response_model=NonceResponse)
async def get_nonce(req: NonceRequest) -> NonceResponse:
    """Generate a single-use SIWE nonce bound to *address*.

    The nonce is stored in Redis with a TTL of ``NONCE_TTL_SECONDS``.  A new
    call overwrites any existing nonce for the same address, so clients should
    treat nonces as single-use.
    """
    address = req.address.lower()
    nonce = secrets.token_hex(16)
    redis = get_redis()
    await redis.setex(_nonce_key(address), settings.nonce_ttl_seconds, nonce)
    return NonceResponse(nonce=nonce, address=req.address)


@app.post("/v1/auth/verify", response_model=TokenResponse)
async def verify_signature(req: VerifyRequest) -> TokenResponse:
    """Verify a SIWE signature and issue JWT + refresh token.

    Replay protection: the nonce is deleted from Redis after the first
    successful verification so it cannot be reused.
    """
    address = req.address.lower()
    redis = get_redis()

    # 1. Load the stored nonce ──────────────────────────────────────────────────
    stored_nonce = await redis.get(_nonce_key(address))
    if not stored_nonce:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nonce not found or expired. Request a new nonce.",
        )

    # 2. Parse the SIWE message ─────────────────────────────────────────────────
    try:
        siwe_msg = SiweMessage(message=req.message)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid SIWE message: {exc}",
        ) from exc

    # 3. Verify nonce matches ───────────────────────────────────────────────────
    if siwe_msg.nonce != stored_nonce:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nonce mismatch. Request a new nonce.",
        )

    # 4. Verify address matches ─────────────────────────────────────────────────
    if siwe_msg.address.lower() != address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Address in SIWE message does not match request.",
        )

    # 5. Verify signature ───────────────────────────────────────────────────────
    try:
        siwe_msg.verify(req.signature)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"SIWE signature verification failed: {exc}",
        ) from exc

    # 6. Consume nonce (replay protection) ─────────────────────────────────────
    await redis.delete(_nonce_key(address))

    # 7. Issue tokens ───────────────────────────────────────────────────────────
    jti = secrets.token_hex(16)
    chain_id = siwe_msg.chain_id or req.chain_id or 1
    access_token = _issue_access_token(address, chain_id, jti)
    refresh = _issue_refresh_token(address, jti)

    # Store refresh token in Redis so we can revoke it later.
    # Include chain_id so we can restore it on refresh without re-decoding
    # from the (potentially expired) access token.
    await redis.setex(
        _refresh_key(jti),
        settings.refresh_token_expire_days * 86400,
        f"{address}:{chain_id}",
    )

    return TokenResponse(
        token=access_token,
        refresh_token=refresh,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@app.post("/v1/auth/refresh", response_model=TokenResponse)
async def refresh_token_endpoint(req: RefreshRequest) -> TokenResponse:
    """Issue a new access token given a valid refresh token."""
    payload = _decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not a refresh token."
        )

    jti = payload["jti"]
    address = payload["sub"]
    redis = get_redis()

    # Check refresh token is not revoked
    stored = await redis.get(_refresh_key(jti))
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or expired."
        )

    # Rotate refresh token — restore chain_id from Redis
    new_jti = secrets.token_hex(16)
    stored_value = stored  # format: "address:chain_id" or legacy "address"
    stored_parts = stored_value.split(":", 1)
    try:
        restored_chain_id = int(stored_parts[1]) if len(stored_parts) == 2 else 0
    except (ValueError, IndexError):
        restored_chain_id = 0
    new_access = _issue_access_token(address, restored_chain_id, new_jti)
    new_refresh = _issue_refresh_token(address, new_jti)

    await redis.delete(_refresh_key(jti))
    await redis.setex(
        _refresh_key(new_jti),
        settings.refresh_token_expire_days * 86400,
        f"{address}:{restored_chain_id}",
    )

    return TokenResponse(
        token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@app.post("/v1/auth/logout")
async def logout(request: Request) -> dict:
    """Revoke refresh token to invalidate the session."""
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        body = {}
    refresh = body.get("refresh_token")
    if refresh:
        try:
            decoded = _decode_token(refresh)
            jti = decoded.get("jti")
            if jti:
                await get_redis().delete(_refresh_key(jti))
        except HTTPException:
            pass  # Token already invalid — logout is idempotent
    return {"success": True}


@app.get("/v1/auth/me", response_model=MeResponse)
async def me(request: Request) -> MeResponse:
    """Return the address and chain_id encoded in the bearer token."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = auth_header.removeprefix("Bearer ")
    payload = _decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not an access token")
    return MeResponse(address=payload["sub"], chain_id=payload.get("chain_id"))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8001")))

