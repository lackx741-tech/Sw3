"""SW3 Auth Service – SIWE-based authentication with JWT sessions."""
from __future__ import annotations
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SW3 Auth Service", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth-service"}

@app.post("/v1/auth/nonce")
async def get_nonce(address: str):
    """Generate a SIWE nonce for the given address."""
    import secrets
    return {"nonce": secrets.token_hex(16), "address": address}

@app.post("/v1/auth/verify")
async def verify_signature(payload: dict):
    """Verify a SIWE signature and return a JWT."""
    # Production: use siwe-python + python-jose
    return {"access_token": "placeholder", "token_type": "bearer"}

@app.post("/v1/auth/refresh")
async def refresh_token(payload: dict):
    return {"access_token": "placeholder", "token_type": "bearer"}

@app.post("/v1/auth/logout")
async def logout():
    return {"success": True}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8001")))
