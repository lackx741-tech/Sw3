from fastapi import APIRouter

router = APIRouter()


@router.get("/sweeps" if "sweeps" != "health" else "/health")
async def sweeps_root():
    return {"status": "ok", "service": "sweeps"}
