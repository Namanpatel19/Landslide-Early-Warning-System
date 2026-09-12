import logging
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db, AutoScannedLocationModel
from app.schemas import AutoScannedLocationResponse
from app.tasks import run_sweep

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sweeper", tags=["Auto-Sweeper"])

@router.get("/latest", response_model=List[AutoScannedLocationResponse])
async def get_latest_scans(db: AsyncSession = Depends(get_db)):
    """
    Returns the latest risk assessment for all auto-scanned critical locations,
    sorted by highest risk score first.
    """
    # Fetch the most recent scan for each location name
    # SQLite doesn't support DISTINCT ON, so we fetch the latest timestamp per location
    stmt = """
        SELECT a.* FROM auto_scanned a
        INNER JOIN (
            SELECT location_name, MAX(timestamp) as max_ts
            FROM auto_scanned
            GROUP BY location_name
        ) b ON a.location_name = b.location_name AND a.timestamp = b.max_ts
        ORDER BY a.risk_score DESC
    """
    from sqlalchemy import text
    result = await db.execute(text(stmt))
    records = result.fetchall()
    
    return [
        {
            "id": r.id,
            "lat": r.lat,
            "lon": r.lon,
            "location_name": r.location_name,
            "risk_level": r.risk_level,
            "confidence": r.confidence,
            "risk_score": r.risk_score,
            "gemini_explanation": r.gemini_explanation,
            "timestamp": r.timestamp
        }
        for r in records
    ]

@router.post("/force")
async def force_sweep():
    """
    Triggers an immediate sweep of all locations (for demo purposes).
    Runs as a background task so it doesn't block the request.
    """
    import asyncio
    loop = asyncio.get_running_loop()
    loop.create_task(run_sweep())
    return {"status": "sweep_initiated", "message": "Background sweep started for all critical locations."}
