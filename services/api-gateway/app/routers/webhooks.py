from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def webhooks_root():
    return {"status": "ok", "service": "webhooks"}
