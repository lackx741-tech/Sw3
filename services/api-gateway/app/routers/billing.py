from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def billing_root():
    return {"status": "ok", "service": "billing"}
