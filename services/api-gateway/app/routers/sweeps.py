from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def sweeps_root():
    return {"status": "ok", "service": "sweeps"}
