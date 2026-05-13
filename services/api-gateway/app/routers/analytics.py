from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def analytics_root():
    return {"status": "ok", "service": "analytics"}
