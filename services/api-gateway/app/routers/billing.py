from fastapi import APIRouter

router = APIRouter()


@router.get("/billing" if "billing" != "health" else "/health")
async def billing_root():
    return {"status": "ok", "service": "billing"}
