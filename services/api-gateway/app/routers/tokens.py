from fastapi import APIRouter

router = APIRouter()


@router.get("/tokens" if "tokens" != "health" else "/health")
async def tokens_root():
    return {"status": "ok", "service": "tokens"}
