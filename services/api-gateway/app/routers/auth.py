from fastapi import APIRouter

router = APIRouter()


@router.get("/auth" if "auth" != "health" else "/health")
async def auth_root():
    return {"status": "ok", "service": "auth"}
