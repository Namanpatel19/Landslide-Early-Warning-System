"""
History Router — /history endpoint
====================================
Returns past predictions for trend analysis and region monitoring.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone

from ..database import get_db, PredictionModel
from ..schemas import PredictionRecord, HistoryResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/history", tags=["History"])


@router.get("", response_model=HistoryResponse)
async def get_history(
    limit: int = Query(default=50, le=200),
    risk_level: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Return recent prediction history.
    Optional filter by risk_level (Low/Medium/High/Critical).
    Used for: trend analysis, high-risk zones list on dashboard.
    """
    stmt = select(PredictionModel).order_by(desc(PredictionModel.timestamp)).limit(limit)
    if risk_level:
        stmt = stmt.where(PredictionModel.risk_level == risk_level)

    result = await db.execute(stmt)
    records = result.scalars().all()

    return HistoryResponse(
        records=[
            PredictionRecord(
                id=r.id,
                lat=r.lat,
                lon=r.lon,
                location_name=r.location_name,
                risk_level=r.risk_level,
                confidence=r.confidence,
                risk_score=r.risk_score,
                timestamp=r.timestamp if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc),
            )
            for r in records
        ],
        total=len(records),
    )


@router.get("/high-risk-zones")
async def get_high_risk_zones(db: AsyncSession = Depends(get_db)):
    """
    Return distinct locations with recent High/Critical predictions.
    Used for the 'Current High-Risk Zones' panel on dashboard.
    """
    stmt = (
        select(PredictionModel)
        .where(PredictionModel.risk_level.in_(["High", "Critical"]))
        .order_by(desc(PredictionModel.timestamp))
        .limit(20)
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    return {
        "zones": [
            {
                "id": r.id,
                "lat": r.lat,
                "lon": r.lon,
                "location_name": r.location_name,
                "risk_level": r.risk_level,
                "confidence": round(r.confidence * 100, 1),
                "timestamp": (r.timestamp if r.timestamp.tzinfo
                              else r.timestamp.replace(tzinfo=timezone.utc)).isoformat(),
            }
            for r in records
        ],
        "total": len(records),
    }
