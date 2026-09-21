import asyncio
import logging
import json
import base64
from datetime import datetime, timezone
from app.database import AsyncSessionLocal, AutoScannedLocationModel, AlertModel, TruePositiveModel
from app.ml.model import predict, is_model_loaded
from app.ml.image_features import extract_image_features, ensemble_risk_score
from app.services.weather import fetch_current_weather
from app.services.geo import fetch_geo_features
from app.services.seismic import fetch_seismic_activity
from app.services.satellite import get_satellite_data
from app.services.gemini_service import generate_risk_explanation, analyze_landslide_image_bytes

logger = logging.getLogger(__name__)

from app.database import AsyncSessionLocal, AutoScannedLocationModel, AlertModel, TruePositiveModel, MonitoredGridModel, PublicAlertModel
from sqlalchemy import select, or_, case, desc

# ─── Sync Frequency ──────────────────────────────────────────────────────────
SWEEP_INTERVAL_SECONDS = 120
DELAY_BETWEEN_LOCATIONS = 1.5
MAX_POINTS_PER_SWEEP = 8

_sweeper_task = None


async def run_sweep():
    """
    Runs prediction for every critical location and saves to DB.

    Pipeline per location:
    1. Fetch weather (Open-Meteo), seismic (USGS), satellite tile
    2. Run RandomForest tabular inference (primary model, 75% weight)
    3. Extract classical CV image features from satellite tile (15% weight)
    4. Run Gemini Vision on satellite tile for visual risk assessment (10% weight)
    5. Compute ensemble score with proper weighting
    6. Generate Gemini plain-language explanation
    7. Save result + trigger alert if High/Critical
    """
    if not is_model_loaded():
        logger.warning("Sweeper skipped: ML model not loaded.")
        return

    logger.info("Starting background sweep for dynamic grid locations...")

    async with AsyncSessionLocal() as db:
        # Tiered Sync Query
        # Tier 1: High/Critical > 15m
        # Tier 2: Medium > 30m
        # Tier 3: Low/Pending > 60m
        now_utc = datetime.now(timezone.utc)
        
        stmt = select(MonitoredGridModel).where(
            or_(
                MonitoredGridModel.last_synced == None,
                # Tier 1
                (MonitoredGridModel.last_risk_level.in_(["High", "Critical"])) & 
                ((now_utc.timestamp() - case((MonitoredGridModel.last_synced != None, MonitoredGridModel.last_synced), else_=0)) > 15 * 60),  # Not valid in sqlite strictly with timestamps, let's process in memory if we have to, or use native SQL.
            )
        )
        
        # Actually, since SQLite date math is tricky in SQLAlchemy, we will fetch points, 
        # compute due in Python, and pick top 15.
        all_points_res = await db.execute(select(MonitoredGridModel))
        all_points = all_points_res.scalars().all()
        
        due_points = []
        for pt in all_points:
            if not pt.last_synced:
                due_points.append((pt, 0)) # Highest priority
                continue
                
            elapsed_mins = (now_utc - pt.last_synced.replace(tzinfo=timezone.utc)).total_seconds() / 60
            
            if pt.last_risk_level in ["High", "Critical"] and elapsed_mins > 15:
                due_points.append((pt, 1))
            elif pt.last_risk_level == "Medium" and elapsed_mins > 30:
                due_points.append((pt, 2))
            elif pt.last_risk_level in ["Low", "Pending"] and elapsed_mins > 60:
                due_points.append((pt, 3))

        # Sort by priority tier, then by longest time since last sync
        due_points.sort(key=lambda x: (x[1], x[0].last_synced or datetime.min.replace(tzinfo=timezone.utc)))
        
        target_points = [p[0] for p in due_points[:MAX_POINTS_PER_SWEEP]]
        
        if not target_points:
            logger.info("No points due for syncing at this time.")
            return

        for loc in target_points:
            try:
                lat, lon, name = loc.lat, loc.lon, loc.location_name
                logger.info(f"Sweeping: {name} ({lat:.3f}, {lon:.3f})")

                # ── Fetch all data concurrently ───────────────────────────────
                weather, seismic, satellite = await asyncio.gather(
                    fetch_current_weather(lat, lon),
                    fetch_seismic_activity(lat, lon),
                    get_satellite_data(lat, lon),
                )
                geo = fetch_geo_features(lat, lon)

                # ── Build feature vector ──────────────────────────────────────
                features = {
                    **{k: v for k, v in geo.items() if k != "region_name"},
                    "rainfall_intensity_mm": weather["rainfall_intensity_mm"],
                    "humidity":              weather["humidity"],
                    "temperature":           weather["temperature"],
                    "soil_moisture":         weather["soil_moisture"],
                    "seismic_activity":      seismic,
                }

                # ── Tabular ML inference (primary: 75%) ───────────────────────
                result = predict(features)
                features["vibration_level"] = result["vibration_level"]

                # ── Image features (CNN/CV: 15%) + Gemini Vision (10%) ────────
                image_features = None
                gemini_vision_severity = "Pending"

                if satellite.get("image_b64"):
                    img_bytes = base64.b64decode(satellite["image_b64"])
                    image_features = extract_image_features(img_bytes)

                    # Gemini Vision: detect cracks, erosion, bare soil visually
                    # PROTOTYPE FIX: Bypassing Gemini Vision in background sweeper to save strict 20 API request quota for Citizen Portal image uploads!
                    gemini_vision_severity = "Pending"
                    logger.info(f"  → Gemini Vision: Bypassed to preserve API quota")

                # ── Ensemble score: 75% tabular + 15% image + 10% Gemini ──────
                ensemble_sc = ensemble_risk_score(
                    tabular_score=result["risk_score"],
                    image_features=image_features,
                    image_weight=0.15,
                    gemini_severity=gemini_vision_severity,
                )

                # ── RAG Context Fetching ──────────────────────────────────────

                stmt = select(TruePositiveModel).where(
                    TruePositiveModel.location_name == name
                ).order_by(desc(TruePositiveModel.timestamp)).limit(3)
                tp_res = await db.execute(stmt)
                past_events = tp_res.scalars().all()
                rag_context = ""
                if past_events:
                    rag_context = "RAG Context (Past confirmed landslides at this location):\n"
                    for ev in past_events:
                        rag_context += f"- Confirmed landslide occurred here previously with these conditions: {ev.features_json}\n"

                # ── Gemini text explanation ───────────────────────────────────
                # PROTOTYPE FIX: Bypassing Gemini explanation in sweeper to save strict 20 API request quota for Citizen Portal!
                explanation = f"Automated alert: High soil moisture ({weather['soil_moisture']*100:.1f}%) and steep slope ({geo.get('slope_angle', 0)}°) detected."
                # ── Persist result ────────────────────────────────────────────
                now = datetime.now(timezone.utc)
                db.add(AutoScannedLocationModel(
                    lat=lat,
                    lon=lon,
                    location_name=name,
                    risk_level=result["risk_level"],
                    confidence=result["confidence"],
                    risk_score=ensemble_sc,
                    features_json=json.dumps(features),
                    gemini_explanation=explanation,
                    timestamp=now,
                ))

                # ── Alert if escalated to High/Critical ─────────────────────────
                if result["risk_level"] in ("High", "Critical") and loc.last_risk_level not in ("High", "Critical"):
                    db.add(AlertModel(
                        lat=lat,
                        lon=lon,
                        location_name=name,
                        risk_level=result["risk_level"],
                        confidence=result["confidence"],
                        risk_score=ensemble_sc,
                        top_factors_json=json.dumps(result["top_factors"]),
                        notified=False,
                        timestamp=now,
                    ))
                    
                    if result["risk_level"] == "Critical":
                        db.add(PublicAlertModel(
                            location_name=name,
                            message=f"⚠️ High landslide risk detected near {name}. Avoid the marked zone. Stay alert for updates.",
                            timestamp=now,
                        ))

                    logger.warning(
                        f"  → ALERT ESCALATED: {result['risk_level']} @ {name} | "
                        f"conf={result['confidence']*100:.1f}% | score={ensemble_sc:.3f}"
                    )
                    
                    # ── Trigger SMS if > 90% Risk Score ───────────────────────
                    if ensemble_sc >= 0.90:
                        from app.database import AuthorityContactModel
                        from app.services.sms_service import send_sms_alert
                        
                        stmt = select(AuthorityContactModel).where(AuthorityContactModel.is_active == True)
                        contacts_res = await db.execute(stmt)
                        contacts = contacts_res.scalars().all()
                        
                        phone_numbers = [c.phone_number for c in contacts]
                        if phone_numbers:
                            msg = f"CRITICAL ALERT: AI-Based Risk Monitoring NER detected >90% landslide risk at {name}. Immediate verification required."
                            await send_sms_alert(phone_numbers, msg)

                loc.last_synced = now
                loc.last_risk_level = result["risk_level"]
                await db.commit()

            except Exception as e:
                logger.error(f"Error sweeping {loc.location_name}: {e}", exc_info=True)

            # Rate-limit backoff between locations
            await asyncio.sleep(DELAY_BETWEEN_LOCATIONS)

    logger.info("Background sweep complete.")


async def sweeper_loop():
    """Infinite background loop — runs sweep every SWEEP_INTERVAL_SECONDS."""
    while True:
        try:
            await run_sweep()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Sweeper loop error: {e}")
        await asyncio.sleep(SWEEP_INTERVAL_SECONDS)


def start_sweeper():
    global _sweeper_task
    if _sweeper_task is None:
        loop = asyncio.get_running_loop()
        _sweeper_task = loop.create_task(sweeper_loop())
        logger.info(f"Background sweeper started — running every {SWEEP_INTERVAL_SECONDS}s.")


def stop_sweeper():
    global _sweeper_task
    if _sweeper_task is not None:
        _sweeper_task.cancel()
        _sweeper_task = None
        logger.info("Background sweeper stopped.")
