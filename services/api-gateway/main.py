"""
SW3 API Gateway – FastAPI entry point.

Provides a unified HTTP/REST interface for all SW3 platform services.
Routes are proxied / aggregated from internal microservices.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.redis import close_redis, init_redis
from app.middleware.correlation import CorrelationIDMiddleware
from app.routers import (
    analytics,
    auth,
    billing,
    health,
    simulate,
    sweeps,
    tokens,
    webhooks,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # noqa: ARG001
    configure_logging()
    await init_redis()
    logger.info("API Gateway started", extra={"env": settings.environment})
    yield
    await close_redis()
    logger.info("API Gateway shutdown")


app = FastAPI(
    title="SW3 API Gateway",
    description="Enterprise ERC-20 sweeping platform – unified API",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
    lifespan=lifespan,
)

# ── Middleware ──────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(CorrelationIDMiddleware)

# ── Prometheus metrics ──────────────────────────────────────────────────────
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix="/v1/auth", tags=["auth"])
app.include_router(sweeps.router, prefix="/v1/sweeps", tags=["sweeps"])
app.include_router(simulate.router, prefix="/v1/simulate", tags=["simulate"])
app.include_router(tokens.router, prefix="/v1/tokens", tags=["tokens"])
app.include_router(analytics.router, prefix="/v1/analytics", tags=["analytics"])
app.include_router(billing.router, prefix="/v1/billing", tags=["billing"])
app.include_router(webhooks.router, prefix="/v1/webhooks", tags=["webhooks"])


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=settings.environment == "development",
        log_config=None,
    )
