"""
Geocoding Service — OpenStreetMap Nominatim
============================================
Converts lat/lon → human-readable place name (reverse geocoding).
Completely free, no API key required.
API: https://nominatim.openstreetmap.org/reverse

Usage policy: max 1 req/sec, include a meaningful User-Agent.
We cache results for 60 minutes (geo data never changes).
"""

import logging
import httpx
from .cache import geo_cache

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
HEADERS = {
    # Nominatim requires a descriptive User-Agent per their usage policy
    "User-Agent": "LandWatchNER/1.0 SIH2024 (landwatch-ner@example.com)"
}
TIMEOUT = 8.0


async def reverse_geocode(lat: float, lon: float) -> str:
    """
    Returns a human-readable location string for the given coordinates.
    Example: "Shillong, East Khasi Hills, Meghalaya, India"

    Falls back to a formatted coordinate string on failure.
    """
    cache_key = f"geocode:{lat:.3f}:{lon:.3f}"
    cached = geo_cache.get(cache_key)
    if cached:
        return cached

    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "zoom": 10,           # district-level detail
        "addressdetails": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers=HEADERS) as client:
            resp = await client.get(NOMINATIM_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        addr = data.get("address", {})

        # Build a clean location string: "Village/Town, District, State"
        parts = []
        for key in ["village", "town", "suburb", "city", "county",
                    "state_district", "state"]:
            v = addr.get(key)
            if v and v not in parts:
                parts.append(v)

        # Keep at most 3 levels + coordinates
        location = ", ".join(parts[:3]) if parts else data.get("display_name", "")
        location = f"{location} ({lat:.4f}°N, {lon:.4f}°E)"

        geo_cache.set(cache_key, location, ttl=3600)
        logger.info(f"Geocoded {lat},{lon} → {location[:60]}")
        return location

    except Exception as e:
        logger.warning(f"Nominatim failed for {lat},{lon}: {e}")
        # Fallback: NER sub-region name from our geo service
        from .geo import get_location_name
        return get_location_name(lat, lon)
