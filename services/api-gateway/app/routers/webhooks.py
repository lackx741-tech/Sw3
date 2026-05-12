from fastapi import APIRouter

router = APIRouter()


@router.get("/webhooks" if "webhooks" != "health" else "/health")
async def webhooks_root():
    return {"status": "ok", "service": "webhooks"}
