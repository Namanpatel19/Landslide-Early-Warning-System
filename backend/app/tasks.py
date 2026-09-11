import asyncio
import logging
import json
from datetime import datetime, timezone
from app.database import AsyncSessionLocal, AutoScannedLocationModel, AlertModel
from app.ml.model import predict, is_model_loaded
from app.ml.image_features import extract_image_features, ensemble_risk_score
from app.services.weather import fetch_current_weather
from app.services.geo import fetch_geo_features
from app.services.seismic import fetch_seismic_activity
from app.services.satellite import get_satellite_data

logger = logging.getLogger(__name__)

# Pre-defined list of high-risk areas in NER to scan
CRITICAL_LOCATIONS = [
    {"name": "Mangan, Sikkim", "lat": 27.50, "lon": 88.53},
    {"name": "Tawang, Arunachal Pradesh", "lat": 27.58, "lon": 91.86},
    {"name": "Cherrapunji, Meghalaya", "lat": 25.28, "lon": 91.73},
    {"name": "Noney, Manipur", "lat": 24.81, "lon": 93.63},
    {"name": "Aizawl, Mizoram", "lat": 23.73, "lon": 92.71},
    {"name": "Kohima, Nagaland", "lat": 25.67, "lon": 94.10},
    {"name": "Dima Hasao, Assam", "lat": 25.18, "lon": 93.02}
]

# Run every 20 minutes (1200 seconds)
SWEEP_INTERVAL_SECONDS = 1200
# Delay between each location to avoid rate limits
DELAY_BETWEEN_LOCATIONS = 5

_sweeper_task = None

async def run_sweep():
    """Runs a prediction for each critical location and saves to DB."""
    if not is_model_loaded():
        logger.warning("Sweeper skipped: ML model not loaded.")
        return

    logger.info("Starting background sweep of critical locations...")
    
    async with AsyncSessionLocal() as db:
        # Clear old scanned results first (or we could just keep appending and fetch latest)
        # We will just append and let the API fetch the latest per location.
        
        for loc in CRITICAL_LOCATIONS:
            try:
                lat, lon, name = loc["lat"], loc["lon"], loc["name"]
                logger.info(f"Sweeping: {name} ({lat}, {lon})")
                
                # Fetch data
                weather = await fetch_current_weather(lat, lon)
                seismic = await fetch_seismic_activity(lat, lon)
                satellite = await get_satellite_data(lat, lon)
                geo = fetch_geo_features(lat, lon)
                
                # Build features
                features = {
                    **{k: v for k, v in geo.items() if k not in ("region_name",)},
                    "rainfall_intensity_mm": weather["rainfall_intensity_mm"],
                    "humidity":              weather["humidity"],
                    "temperature":           weather["temperature"],
                    "soil_moisture":         weather["soil_moisture"],
                    "seismic_activity":      seismic,
                }
                
                # Predict
                result = predict(features)
                features["vibration_level"] = result["vibration_level"]
                
                image_features = None
                if satellite.get("image_b64"):
                    import base64
                    image_features = extract_image_features(base64.b64decode(satellite["image_b64"]))
                    
                ensemble_score = ensemble_risk_score(result["risk_score"], image_features)
                
                # Save to AutoScannedLocationModel
                now = datetime.now(timezone.utc)
                record = AutoScannedLocationModel(
                    lat=lat,
                    lon=lon,
                    location_name=name,
                    risk_level=result["risk_level"],
                    confidence=result["confidence"],
                    risk_score=ensemble_score,
                    features_json=json.dumps(features),
                    timestamp=now
                )
                db.add(record)
                
                # Trigger alert if critical
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
                
                await db.commit()
                
            except Exception as e:
                logger.error(f"Error sweeping {loc['name']}: {e}")
                
            # Rate limit backoff
            await asyncio.sleep(DELAY_BETWEEN_LOCATIONS)
            
    logger.info("Background sweep complete.")

async def sweeper_loop():
    """Infinite loop for the background sweeper."""
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
        logger.info("Background sweeper task started.")

def stop_sweeper():
    global _sweeper_task
    if _sweeper_task is not None:
        _sweeper_task.cancel()
        _sweeper_task = None
        logger.info("Background sweeper task stopped.")
