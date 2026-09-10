"""
Weather Service — Open-Meteo API Client
========================================
Fetches real-time weather data (no API key required).
API docs: https://open-meteo.com/en/docs

Fields fetched:
  - precipitation (rainfall_intensity_mm)
  - relative_humidity_2m (humidity)
  - temperature_2m (temperature)
  - soil_moisture_0_to_1cm (soil_moisture)
  - also fetches 7-day historical for trend chart
"""

import httpx
import logging
from typing import Optional
from .cache import weather_cache

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_HISTORY_URL = "https://archive-api.open-meteo.com/v1/archive"

# Timeout for external API calls (generous for free tier)
REQUEST_TIMEOUT = 10.0


async def fetch_current_weather(lat: float, lon: float) -> dict:
    """
    Fetch current weather conditions from Open-Meteo.
    Returns dict with: rainfall_intensity_mm, humidity, temperature, soil_moisture
    Caches result for 5 minutes to respect free API limits.
    """
    cache_key = f"weather:{lat:.3f}:{lon:.3f}"
    cached = weather_cache.get(cache_key)
    if cached:
        logger.debug(f"Cache HIT for weather at {lat},{lon}")
        return {**cached, "cached": True}

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "precipitation",
            "relative_humidity_2m",
            "temperature_2m",
            "soil_moisture_0_to_1cm",
        ],
        "hourly": "precipitation",
        "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        current = data.get("current", {})
        result = {
            "rainfall_intensity_mm": current.get("precipitation", 0.0) * 24,  # mm/hour → mm/day approx
            "humidity": current.get("relative_humidity_2m", 70.0),
            "temperature": current.get("temperature_2m", 22.0),
            "soil_moisture": current.get("soil_moisture_0_to_1cm", 0.3),
            "cached": False,
        }

        # Clamp soil moisture to [0, 1]
        result["soil_moisture"] = max(0.0, min(1.0, result["soil_moisture"]))
        result["rainfall_intensity_mm"] = max(0.0, result["rainfall_intensity_mm"])

        weather_cache.set(cache_key, result)
        logger.info(f"Weather fetched for {lat},{lon}: {result}")
        return result

    except Exception as e:
        logger.warning(f"Open-Meteo fetch failed for {lat},{lon}: {e}. Using defaults.")
        # Fallback: realistic NER monsoon defaults (avoid crashing the demo)
        return {
            "rainfall_intensity_mm": 45.0,
            "humidity": 82.0,
            "temperature": 24.0,
            "soil_moisture": 0.55,
            "cached": False,
        }


async def fetch_rainfall_history(lat: float, lon: float, days: int = 7) -> list[dict]:
    """
    Fetch historical daily rainfall for trend chart (last N days).
    Uses Open-Meteo Archive API (free, no key).
    Returns list of {date, rainfall_mm} dicts.
    """
    from datetime import date, timedelta

    cache_key = f"history:{lat:.3f}:{lon:.3f}:{days}"
    cached = weather_cache.get(cache_key)
    if cached:
        return cached

    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": "precipitation_sum",
        "timezone": "Asia/Kolkata",
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(OPEN_METEO_HISTORY_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        dates = data.get("daily", {}).get("time", [])
        rain = data.get("daily", {}).get("precipitation_sum", [])
        result = [
            {"date": d, "rainfall_mm": r if r is not None else 0.0}
            for d, r in zip(dates, rain)
        ]
        weather_cache.set(cache_key, result, ttl=600)
        return result

    except Exception as e:
        logger.warning(f"Rainfall history fetch failed: {e}. Using mock data.")
        # Return realistic monsoon mock data for demo
        from datetime import date, timedelta
        import random
        random.seed(int(lat * lon) % 1000)
        return [
            {
                "date": (date.today() - timedelta(days=days - i)).isoformat(),
                "rainfall_mm": round(random.uniform(5, 120), 1)
            }
            for i in range(days + 1)
        ]
