"""Correlation ID middleware for the SW3 API Gateway.

Reads X-Correlation-ID from incoming requests (or generates a UUID if absent),
stores it in a context variable, and echoes it back in the response header.
Downstream proxy calls should forward the same header.
"""
from __future__ import annotations

import uuid
from contextvars import ContextVar
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# Context variable so any coroutine in the request scope can access the ID
_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")

HEADER_NAME = "X-Correlation-ID"


def get_correlation_id() -> str:
    """Return the correlation ID for the current request."""
    return _correlation_id.get()


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Inject and propagate a per-request correlation ID."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        cid = request.headers.get(HEADER_NAME) or str(uuid.uuid4())
        token = _correlation_id.set(cid)
        try:
            response: Response = await call_next(request)
        finally:
            _correlation_id.reset(token)
        response.headers[HEADER_NAME] = cid
        return response
