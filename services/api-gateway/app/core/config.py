from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    secret_key: str = "change-me-in-production"
    cors_origins: List[str] = ["http://localhost:3000"]
    allowed_hosts: List[str] = ["*"]

    # Database
    database_url: str = "postgresql+asyncpg://sw3:sw3@localhost:5432/sw3"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # Internal services
    auth_service_url: str = "http://auth-service:8001"
    execution_engine_url: str = "http://execution-engine:8080"
    simulation_engine_url: str = "http://simulation-engine:8082"
    analytics_service_url: str = "http://analytics-service:8004"
    billing_service_url: str = "http://billing-service:8005"
    webhook_service_url: str = "http://webhook-service:8006"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
