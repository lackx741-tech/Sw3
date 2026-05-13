"""SW3 analytics-service – FastAPI microservice."""
from __future__ import annotations

import logging
import os
import json
from datetime import datetime, timezone
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

app = FastAPI(title="SW3 analytics-service", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "clickhouse")
CLICKHOUSE_PORT = int(os.getenv("CLICKHOUSE_PORT", "8123"))
CLICKHOUSE_DATABASE = os.getenv("CLICKHOUSE_DATABASE", "sw3_analytics")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")
CLICKHOUSE_TIMEOUT_SECONDS = float(os.getenv("CLICKHOUSE_TIMEOUT_SECONDS", "2.5"))
CLICKHOUSE_URL = f"http://{CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}"


def _clickhouse_params(include_database: bool = True) -> dict[str, str]:
    params = {"user": CLICKHOUSE_USER}
    if include_database:
        params["database"] = CLICKHOUSE_DATABASE
    if CLICKHOUSE_PASSWORD:
        params["password"] = CLICKHOUSE_PASSWORD
    return params


async def _run_clickhouse_query(query: str, include_database: bool = True) -> None:
    async with httpx.AsyncClient(timeout=CLICKHOUSE_TIMEOUT_SECONDS) as client:
        response = await client.post(
            CLICKHOUSE_URL,
            params=_clickhouse_params(include_database=include_database),
            content=query,
        )
        response.raise_for_status()


async def _ensure_clickhouse_schema() -> None:
    try:
        await _run_clickhouse_query(
            f"CREATE DATABASE IF NOT EXISTS {CLICKHOUSE_DATABASE}",
            include_database=False,
        )
        await _run_clickhouse_query(
            """
            CREATE TABLE IF NOT EXISTS analytics_events
            (
                event_type String,
                address Nullable(String),
                chain_id Nullable(UInt64),
                data_json String,
                correlation_id Nullable(String),
                created_at DateTime64(3, 'UTC')
            )
            ENGINE = MergeTree
            ORDER BY (event_type, created_at)
            TTL created_at + INTERVAL 30 DAY
            SETTINGS index_granularity = 8192
            """
        )
        logger.info("clickhouse_schema_ready", extra={"database": CLICKHOUSE_DATABASE})
    except Exception as exc:  # noqa: BLE001
        logger.warning("clickhouse_schema_unavailable", extra={"error": str(exc)})


@app.on_event("startup")
async def startup() -> None:
    await _ensure_clickhouse_schema()


class EventPayload(BaseModel):
    event_type: str
    address: str | None = None
    chain_id: int | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str | None = None


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "analytics-service"}


@app.post("/v1/events", status_code=202)
async def log_event(payload: EventPayload) -> dict:
    """Accept an analytics event and attempt to persist it to ClickHouse."""
    event = {
        "event_type": payload.event_type,
        "address": payload.address,
        "chain_id": payload.chain_id,
        "data": payload.data,
        "correlation_id": payload.correlation_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("analytics_event", extra=event)

    row = {
        "event_type": payload.event_type,
        "address": payload.address,
        "chain_id": payload.chain_id,
        "data_json": json.dumps(payload.data, separators=(",", ":"), sort_keys=True),
        "correlation_id": payload.correlation_id,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
    }
    try:
        async with httpx.AsyncClient(timeout=CLICKHOUSE_TIMEOUT_SECONDS) as client:
            response = await client.post(
                CLICKHOUSE_URL,
                params={**_clickhouse_params(), "query": "INSERT INTO analytics_events FORMAT JSONEachRow"},
                content=f"{json.dumps(row)}\n",
            )
            response.raise_for_status()
        return {"accepted": True, "event_type": payload.event_type, "persisted": True}
    except Exception as exc:  # noqa: BLE001
        logger.warning("clickhouse_write_failed", extra={"error": str(exc), "event_type": payload.event_type})
        return {"accepted": True, "event_type": payload.event_type, "persisted": False, "degraded": True}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8004")))
