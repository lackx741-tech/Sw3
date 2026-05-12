from fastapi import APIRouter

router = APIRouter()


@router.get("/analytics" if "analytics" != "health" else "/health")
async def analytics_root():
    return {"status": "ok", "service": "analytics"}
