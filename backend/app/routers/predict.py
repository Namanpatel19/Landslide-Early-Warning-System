"""
Predict Router — /predict endpoint
====================================
POST /predict: live data fetch → image extraction → ML ensemble → response
GET  /predict/weather-history: 7-day rainfall trend
"""

import json
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import PredictRequest, PredictResponse, FeatureValues
from ..database import get_db, PredictionModel, AlertModel
from ..services.weather import fetch_current_weather, fetch_rainfall_history
from ..services.seismic import fetch_seismic_activity
from ..services.geo import fetch_geo_features
from ..services.geocoding import reverse_geocode        # Real Nominatim geocoding
from ..services.satellite import get_satellite_data     # Satellite imagery
from ..ml.model import predict, is_model_loaded
from ..ml.image_features import extract_image_features, ensemble_risk_score
from ..services.gemini_service import generate_risk_explanation, analyze_landslide_image_bytes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predict", tags=["Prediction"])


@router.post("", response_model=PredictResponse)
async def predict_risk(
    req: PredictRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Main prediction endpoint — full real-data pipeline:

    1. Validate coordinates (NER bounds)
    2. Fetch CONCURRENTLY:
       - Open-Meteo → live rainfall, humidity, temp, soil moisture
       - USGS       → seismic activity (last 7 days, 200km radius)
       - Nominatim  → human-readable location name
       - Satellite  → ESRI tile URL / Sentinel Hub image
    3. Geo lookup → slope, soil type, elevation (NER region profiles)
    4. Tabular RandomForest inference (<1ms)
    5. Image feature extraction (if satellite image available)
    6. Ensemble: 80% tabular + 20% image risk score
    7. Persist to SQLite, log alert if High/Critical
    """
    if not is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run: python scripts/train_model.py",
        )

    # ─── Fetch all external data concurrently (fastest path) ─────────────────
    weather_task  = fetch_current_weather(req.lat, req.lon)
    seismic_task  = fetch_seismic_activity(req.lat, req.lon)
    geocode_task  = reverse_geocode(req.lat, req.lon)        # Real Nominatim
    satellite_task = get_satellite_data(req.lat, req.lon)    # Satellite imagery

    # Geo features are sync (instant local lookup)
    geo_features = fetch_geo_features(req.lat, req.lon)

    # Await all async tasks together
    weather_data, seismic_magnitude, location_name, satellite_data = await asyncio.gather(
        weather_task, seismic_task, geocode_task, satellite_task,
    )

    # Override with user-provided name if given
    if req.location_name:
        location_name = req.location_name

    # ─── Build tabular feature dict ───────────────────────────────────────────
    features = {
        **{k: v for k, v in geo_features.items() if k not in ("region_name",)},
        "rainfall_intensity_mm": weather_data["rainfall_intensity_mm"],
        "rainfall_last_3_days":  weather_data.get("rainfall_last_3_days", 0.0),
        "rainfall_last_7_days":  weather_data.get("rainfall_last_7_days", 0.0),
        "rainfall_last_15_days": weather_data.get("rainfall_last_15_days", 0.0),
        "humidity":              weather_data["humidity"],
        "temperature":           weather_data["temperature"],
        "soil_moisture":         weather_data["soil_moisture"],
        "seismic_activity":      seismic_magnitude,
    }

    # ─── Tabular ML inference (sub-millisecond) ───────────────────────────────
    result = predict(features)
    features["vibration_level"] = result["vibration_level"]

    # ─── Image feature extraction + Gemini Vision ensemble ───────────────────
    image_features = None
    gemini_vision_severity = "Pending"  # Default: no visual data

    if satellite_data.get("image_b64"):
        import base64
        img_bytes = base64.b64decode(satellite_data["image_b64"])
        image_features = extract_image_features(img_bytes)
        logger.info(f"Image features: {image_features}")

        # Run Gemini Vision on satellite image concurrently with persistence
        # Gemini provides supplemental visual assessment (cracks, erosion, bare soil)
        # This contributes ~10% to the final ensemble adjustment
        try:
            gemini_vision_result = await analyze_landslide_image_bytes(img_bytes)
            gemini_vision_severity = gemini_vision_result.get("severity", "Pending")
            logger.info(f"Gemini Vision severity: {gemini_vision_severity}")
        except Exception as e:
            logger.warning(f"Gemini Vision analysis failed (non-critical): {e}")

    # Ensemble weights:
    #   75% Tabular (Random Forest on 13 real-time + geo features) — primary model
    #   15% CNN/CV (classical image features from satellite tile)
    #   10% Gemini Vision (adjusts score +0.05 if Critical, -0.05 if Low)
    # This ensures model accuracy is preserved while Gemini adds multimodal depth.
    ensemble_score = ensemble_risk_score(
        tabular_score=result["risk_score"],
        image_features=image_features,
        image_weight=0.15,
        gemini_severity=gemini_vision_severity,
    )

    now = datetime.now(timezone.utc)

    # ─── Persist prediction ───────────────────────────────────────────────────
    pred_record = PredictionModel(
        lat=req.lat,
        lon=req.lon,
        location_name=location_name,
        risk_level=result["risk_level"],
        confidence=result["confidence"],
        risk_score=ensemble_score,
        features_json=json.dumps(features),
        timestamp=now,
    )
    db.add(pred_record)

    # ─── Log alert if High / Critical ─────────────────────────────────────────
    if result["risk_level"] in ("High", "Critical"):
        db.add(AlertModel(
            lat=req.lat,
            lon=req.lon,
            location_name=location_name,
            risk_level=result["risk_level"],
            confidence=result["confidence"],
            top_factors_json=json.dumps(result["top_factors"]),
            notified=False,
            timestamp=now,
        ))
        logger.warning(
            f"ALERT: {result['risk_level']} @ {location_name} | "
            f"conf={result['confidence']*100:.1f}% | "
            f"ensemble_score={ensemble_score:.3f}"
        )

    await db.commit()

    # ─── Generate Gemini plain-language explanation (Async) ───────────────────
    explanation = await generate_risk_explanation(features, result["risk_level"], result["confidence"])

    return PredictResponse(
        lat=req.lat,
        lon=req.lon,
        location_name=location_name,
        risk_level=result["risk_level"],
        confidence=result["confidence"],
        risk_score=ensemble_score,
        physics_fs=result.get("physics_fs"),
        features=FeatureValues(
            soil_type=features["soil_type"],
            slope_angle=features["slope_angle"],
            elevation=features["elevation"],
            vegetation_index=features["vegetation_index"],
            distance_to_mining_area=features["distance_to_mining_area"],
            distance_to_construction_area=features["distance_to_construction_area"],
            historical_landslide_zone=features["historical_landslide_zone"],
            rainfall_intensity_mm=features["rainfall_intensity_mm"],
            rainfall_last_3_days=features["rainfall_last_3_days"],
            rainfall_last_7_days=features["rainfall_last_7_days"],
            rainfall_last_15_days=features["rainfall_last_15_days"],
            humidity=features["humidity"],
            temperature=features["temperature"],
            soil_moisture=features["soil_moisture"],
            seismic_activity=features["seismic_activity"],
            vibration_level=features["vibration_level"],
            population_density=geo_features.get("population_density", 0),
        ),
        top_factors=result["top_factors"],
        timestamp=now,
        cached=weather_data.get("cached", False),
        gemini_explanation=explanation,
    )


@router.get("/weather-history")
async def get_weather_history(lat: float, lon: float, days: int = 7):
    """Get historical daily rainfall for trend chart (Open-Meteo Archive API)."""
    if not (20 <= lat <= 30 and 88 <= lon <= 98):
        raise HTTPException(400, "Coordinates out of NER bounds.")
    history = await fetch_rainfall_history(lat, lon, days)
    return {"data": history, "lat": lat, "lon": lon}
