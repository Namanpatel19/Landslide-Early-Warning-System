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

from ..database import get_db, AlertModel, TruePositiveModel, AutoScannedLocationModel
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


@router.post("/{alert_id}/true_positive")
async def mark_true_positive(alert_id: int, db: AsyncSession = Depends(get_db)):
    """
    Mark an alert as a 'True Positive' (landslide actually occurred).
    Saves the event to the TruePositiveModel for future RAG injection.
    """
    # 1. Fetch the alert
    stmt = select(AlertModel).where(AlertModel.id == alert_id)
    result = await db.execute(stmt)
    alert = result.scalars().first()
    
    if not alert:
        return {"error": "Alert not found"}, 404

    # 2. Fetch the corresponding features from auto_scanned
    stmt = select(AutoScannedLocationModel).where(
        AutoScannedLocationModel.location_name == alert.location_name
    ).order_by(desc(AutoScannedLocationModel.timestamp)).limit(1)
    result = await db.execute(stmt)
    scan = result.scalars().first()

    features_json = scan.features_json if scan else "{}"

    # 3. Insert into TruePositiveModel
    tp = TruePositiveModel(
        lat=alert.lat,
        lon=alert.lon,
        location_name=alert.location_name,
        risk_level=alert.risk_level,
        confidence=alert.confidence,
        features_json=features_json,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(tp)
    await db.commit()

    logger.info(f"✅ Marked alert {alert_id} ({alert.location_name}) as True Positive.")
    return {"status": "success", "message": "Saved to true positives for RAG."}
