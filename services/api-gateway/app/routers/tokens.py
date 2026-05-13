from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def tokens_root():
    return {"status": "ok", "service": "tokens"}
