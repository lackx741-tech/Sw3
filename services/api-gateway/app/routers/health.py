from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str = "0.1.0"


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="api-gateway")


@router.get("/ready", response_model=HealthResponse)
async def readiness_check() -> HealthResponse:
    return HealthResponse(status="ok", service="api-gateway")
