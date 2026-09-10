"""
Seismic Service — USGS Earthquake API Client
=============================================
Fetches recent earthquake data near a given lat/lon.
API docs: https://earthquake.usgs.gov/fdsnws/event/1/

NER is in Seismic Zone IV/V — the most seismically active region in India.
This service fetches the max magnitude of earthquakes within 200km
in the last 7 days as the seismic_activity feature.
"""

import httpx
import logging
from .cache import geo_cache

logger = logging.getLogger(__name__)

USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
REQUEST_TIMEOUT = 8.0


async def fetch_seismic_activity(lat: float, lon: float, radius_km: int = 200) -> float:
    """
    Fetch max earthquake magnitude within radius_km of the location
    in the last 7 days. Returns magnitude (0.0 if no events).
    
    Cached for 30 minutes (seismic data doesn't change that often).
    """
    cache_key = f"seismic:{lat:.2f}:{lon:.2f}"
    cached = geo_cache.get(cache_key)
    if cached is not None:
        return cached

    from datetime import date, timedelta
    start_time = (date.today() - timedelta(days=7)).isoformat()

    params = {
        "format": "geojson",
        "latitude": lat,
        "longitude": lon,
        "maxradiuskm": radius_km,
        "starttime": start_time,
        "minmagnitude": 1.0,  # Filter out micro-seismic noise
        "orderby": "magnitude",
        "limit": 1,           # We only need the max magnitude
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(USGS_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        features = data.get("features", [])
        if features:
            magnitude = features[0]["properties"]["mag"]
            magnitude = max(0.0, float(magnitude))
        else:
            magnitude = 0.0

        geo_cache.set(cache_key, magnitude, ttl=1800)  # 30 min cache
        logger.info(f"Seismic activity at {lat},{lon}: {magnitude}")
        return magnitude

    except Exception as e:
        logger.warning(f"USGS fetch failed for {lat},{lon}: {e}. Defaulting to 0.")
        return 0.0
