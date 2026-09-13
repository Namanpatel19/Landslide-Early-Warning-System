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

# ─── 20 High-Risk NER Locations ─────────────────────────────────────────────
# Covers all 8 NE states — selected based on:
#  - Historical landslide frequency (GSI records)
#  - High annual rainfall zones (>2000mm/yr)
#  - Steep terrain (>25° slope)
#  - Proximity to rivers/fault lines
CRITICAL_LOCATIONS = [
    # Sikkim
    {"name": "Mangan, Sikkim",            "lat": 27.50, "lon": 88.53, "state": "Sikkim"},
    {"name": "Gangtok Foothills, Sikkim", "lat": 27.33, "lon": 88.61, "state": "Sikkim"},

    # Arunachal Pradesh
    {"name": "Tawang, Arunachal Pradesh",       "lat": 27.58, "lon": 91.86, "state": "Arunachal Pradesh"},
    {"name": "Itanagar Hills, Arunachal Pradesh","lat": 27.08, "lon": 93.60, "state": "Arunachal Pradesh"},
    {"name": "Papum Pare, Arunachal Pradesh",   "lat": 27.15, "lon": 93.75, "state": "Arunachal Pradesh"},
    {"name": "Siang Valley, Arunachal Pradesh",  "lat": 28.00, "lon": 95.00, "state": "Arunachal Pradesh"},

    # Meghalaya
    {"name": "Cherrapunji, Meghalaya",    "lat": 25.28, "lon": 91.73, "state": "Meghalaya"},
    {"name": "Shillong Plateau, Meghalaya","lat": 25.57, "lon": 91.88, "state": "Meghalaya"},
    {"name": "Jaintia Hills, Meghalaya",   "lat": 25.40, "lon": 92.18, "state": "Meghalaya"},

    # Manipur
    {"name": "Noney, Manipur",            "lat": 24.81, "lon": 93.63, "state": "Manipur"},
    {"name": "Senapati, Manipur",         "lat": 25.27, "lon": 93.97, "state": "Manipur"},
    {"name": "Ukhrul, Manipur",           "lat": 25.11, "lon": 94.36, "state": "Manipur"},

    # Mizoram
    {"name": "Aizawl, Mizoram",           "lat": 23.73, "lon": 92.71, "state": "Mizoram"},
    {"name": "Lunglei, Mizoram",          "lat": 22.89, "lon": 92.73, "state": "Mizoram"},

    # Nagaland
    {"name": "Kohima, Nagaland",          "lat": 25.67, "lon": 94.10, "state": "Nagaland"},
    {"name": "Pfutsero, Nagaland",        "lat": 25.54, "lon": 94.02, "state": "Nagaland"},

    # Assam Hill Districts
    {"name": "Dima Hasao, Assam",         "lat": 25.18, "lon": 93.02, "state": "Assam"},
    {"name": "Karbi Anglong, Assam",      "lat": 26.09, "lon": 93.56, "state": "Assam"},

    # Tripura
    {"name": "North Tripura Hills",       "lat": 24.10, "lon": 92.10, "state": "Tripura"},

    # Meghalaya border/Barak Valley
    {"name": "Barak Valley Slopes, Assam","lat": 24.83, "lon": 92.79, "state": "Assam"},
]

# ─── Sync Frequency ──────────────────────────────────────────────────────────
# 2 minutes = 120 seconds
# 20 locations × 1.5s delay = ~30s per full sweep → safe for all free-tier APIs
SWEEP_INTERVAL_SECONDS = 120
# Stagger requests to avoid hitting API rate limits simultaneously
DELAY_BETWEEN_LOCATIONS = 1.5

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

    logger.info(f"Starting background sweep of {len(CRITICAL_LOCATIONS)} critical locations...")

    async with AsyncSessionLocal() as db:
        for loc in CRITICAL_LOCATIONS:
            try:
                lat, lon, name = loc["lat"], loc["lon"], loc["name"]
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
                    try:
                        vision_result = await analyze_landslide_image_bytes(img_bytes)
                        gemini_vision_severity = vision_result.get("severity", "Pending")
                        logger.info(f"  → Gemini Vision: {gemini_vision_severity}")
                    except Exception as e:
                        logger.warning(f"  → Gemini Vision failed (non-critical): {e}")

                # ── Ensemble score: 75% tabular + 15% image + 10% Gemini ──────
                ensemble_sc = ensemble_risk_score(
                    tabular_score=result["risk_score"],
                    image_features=image_features,
                    image_weight=0.15,
                    gemini_severity=gemini_vision_severity,
                )

                # ── RAG Context Fetching ──────────────────────────────────────
                from sqlalchemy import select, desc
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
                explanation = await generate_risk_explanation(
                    features, result["risk_level"], result["confidence"], rag_context
                )

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

                # ── Alert if High/Critical ────────────────────────────────────
                if result["risk_level"] in ("High", "Critical"):
                    db.add(AlertModel(
                        lat=lat,
                        lon=lon,
                        location_name=name,
                        risk_level=result["risk_level"],
                        confidence=result["confidence"],
                        top_factors_json=json.dumps(result["top_factors"]),
                        notified=False,
                        timestamp=now,
                    ))
                    logger.warning(
                        f"  → ALERT: {result['risk_level']} @ {name} | "
                        f"conf={result['confidence']*100:.1f}% | score={ensemble_sc:.3f}"
                    )

                await db.commit()

            except Exception as e:
                logger.error(f"Error sweeping {loc['name']}: {e}", exc_info=True)

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
        logger.info(f"Background sweeper started — {len(CRITICAL_LOCATIONS)} locations, every {SWEEP_INTERVAL_SECONDS}s.")


def stop_sweeper():
    global _sweeper_task
    if _sweeper_task is not None:
        _sweeper_task.cancel()
        _sweeper_task = None
        logger.info("Background sweeper stopped.")
