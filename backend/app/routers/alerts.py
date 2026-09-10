"""
Alerts Router — /alerts endpoint
===================================
Manages the alert log (High/Critical risk events).
"""

import json
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from datetime import datetime, timezone

from ..database import get_db, AlertModel
from ..schemas import AlertRecord, AlertsResponse, NotifyRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=AlertsResponse)
async def get_alerts(
    limit: int = Query(default=50, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Return recent alerts ordered by timestamp descending."""
    stmt = select(AlertModel).order_by(desc(AlertModel.timestamp)).limit(limit)
    result = await db.execute(stmt)
    records = result.scalars().all()

    return AlertsResponse(
        alerts=[
            AlertRecord(
                id=r.id,
                lat=r.lat,
                lon=r.lon,
                location_name=r.location_name,
                risk_level=r.risk_level,
                confidence=r.confidence,
                top_factors=json.loads(r.top_factors_json or "[]"),
                notified=r.notified,
                timestamp=(r.timestamp if r.timestamp.tzinfo
                           else r.timestamp.replace(tzinfo=timezone.utc)),
            )
            for r in records
        ],
        total=len(records),
    )


@router.post("/notify")
async def notify_authorities(
    req: NotifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Log that authorities were notified for this alert.
    
    Future scope:
      - Twilio SMS API (free tier: ~15 credits) for actual SMS
      - Firebase Cloud Messaging for push notifications
      - Email via SendGrid free tier
    """
    logger.warning(
        f"🚨 AUTHORITY NOTIFICATION TRIGGERED for alert ID {req.prediction_id} "
        f"via {req.method}. "
        f"[Future scope: Twilio SMS / Firebase Push / Email integration]"
    )

    # Mark alert as notified in DB
    stmt = (
        update(AlertModel)
        .where(AlertModel.id == req.prediction_id)
        .values(notified=True)
    )
    await db.execute(stmt)
    await db.commit()

    return {
        "status": "logged",
        "message": "Authority notification logged. SMS/Push integration is future scope.",
        "alert_id": req.prediction_id,
        "method": req.method,
    }
