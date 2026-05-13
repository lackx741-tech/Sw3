"""SW3 analytics-service – FastAPI microservice."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel

logger = logging.getLogger(__name__)

app = FastAPI(title="SW3 analytics-service", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


class EventPayload(BaseModel):
    event_type: str
    address: str | None = None
    chain_id: int | None = None
    data: dict[str, Any] = {}
    correlation_id: str | None = None


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "analytics-service"}


@app.post("/v1/events", status_code=202)
async def log_event(payload: EventPayload) -> dict:
    """Accept an analytics event.

    Logs the event as structured JSON. In a production deployment this would
    also write to ClickHouse (table: analytics_events). ClickHouse writes are
    omitted here until the schema migration is applied; the service returns 202
    regardless so callers are never blocked on analytics.
    """
    event = {
        "event_type": payload.event_type,
        "address": payload.address,
        "chain_id": payload.chain_id,
        "data": payload.data,
        "correlation_id": payload.correlation_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("analytics_event", extra=event)
    # TODO: write to ClickHouse once schema migration is applied
    # (see docs/LOCAL_DEV.md — known limitation 4)
    return {"accepted": True, "event_type": payload.event_type}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8004")))
