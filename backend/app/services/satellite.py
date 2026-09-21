"""
Satellite Imagery Service
==========================
Fetches satellite image tiles for a given lat/lon location.

Priority chain:
  1. Planet Labs Data API  (replaces deprecated Sentinel Hub)
     → PlanetScope PSScene imagery — 3-5m resolution
     → Sign up: https://www.planet.com/explorer/
     → Get API key: https://account.planet.com/ → API Access

  2. ESRI World Imagery (completely free, no key, tile-based)
     → Always available as a reliable fallback

The satellite panel in the frontend displays imagery for visual context.
"""

import base64
import logging
import httpx
from ..config import settings
from .cache import geo_cache

logger = logging.getLogger(__name__)
TIMEOUT = 15.0


async def get_satellite_data(lat: float, lon: float) -> dict:
    """
    Returns satellite imagery data for a location.

    Response shape:
    {
        "source": "planet" | "esri",
        "tile_url": str,           # direct tile URL (for ESRI fallback)
        "image_b64": str | None,   # base64 PNG (for Planet)
        "ndvi_estimate": float,    # 0-1 vegetation estimate
        "acquired_date": str,      # approximate date of imagery
        "description": str,
    }
    """
    cache_key = f"satellite:{lat:.2f}:{lon:.2f}"
    cached = geo_cache.get(cache_key)
    if cached:
        return {**cached, "cached": True}

    # ── Option 1: Planet Labs Data API ────────────────────────────────────────
    if settings.has_planet:
        result = await _fetch_planet(lat, lon)
        if result:
            geo_cache.set(cache_key, result, ttl=3600)
            return result

    # ── Option 2: ESRI World Imagery tiles (always free) ─────────────────────
    result = _esri_tile(lat, lon)
    geo_cache.set(cache_key, result, ttl=3600)
    return result


async def _fetch_planet(lat: float, lon: float) -> dict | None:
    """
    Fetch a thumbnail image from Planet Labs Data API.
    Uses PlanetScope PSScene imagery (3-5m resolution).
    Auth: Basic auth with API key as username, empty password.
    """
    api_key = settings.PLANET_API_KEY

    # Search for recent low-cloud images at this location
    search_payload = {
        "item_types": ["PSScene"],
        "filter": {
            "type": "AndFilter",
            "config": [
                {
                    "type": "GeometryFilter",
                    "field_name": "geometry",
                    "config": {
                        "type": "Point",
                        "coordinates": [lon, lat]
                    }
                },
                {
                    "type": "DateRangeFilter",
                    "field_name": "acquired",
                    "config": {
                        "gte": "2024-01-01T00:00:00Z"
                    }
                },
                {
                    "type": "RangeFilter",
                    "field_name": "cloud_cover",
                    "config": {"lte": 0.3}
                }
            ]
        }
    }

    try:
        auth = (api_key, "")  # Planet uses API key as username, empty password
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            # Step 1: Search for available imagery
            search_resp = await client.post(
                "https://api.planet.com/data/v1/quick-search",
                json=search_payload,
                auth=auth,
            )
            search_resp.raise_for_status()
            items = search_resp.json().get("features", [])

            if not items:
                logger.info(f"Planet: No imagery found for {lat},{lon}")
                return None

            # Step 2: Get thumbnail of most recent scene
            item = items[0]
            acquired = item.get("properties", {}).get("acquired", "Unknown")
            thumbnail_url = item.get("_links", {}).get("thumbnail")

            if not thumbnail_url:
                return None

            thumb_resp = await client.get(thumbnail_url, auth=auth)
            thumb_resp.raise_for_status()

            img_b64 = base64.b64encode(thumb_resp.content).decode("utf-8")
            ndvi_est = _estimate_ndvi_from_png(thumb_resp.content)

            logger.info(f"Planet image fetched for {lat},{lon} (acquired: {acquired[:10]})")
            return {
                "source": "planet",
                "tile_url": None,
                "image_b64": img_b64,
                "ndvi_estimate": ndvi_est,
                "acquired_date": acquired[:10],
                "description": "Planet PlanetScope (3-5m resolution) — Recent scene",
                "cached": False,
            }

    except Exception as e:
        logger.warning(f"Planet API failed for {lat},{lon}: {e}")
        return None


def _estimate_ndvi_from_png(png_bytes: bytes) -> float:
    """
    Rough NDVI proxy from a true-colour PNG.
    Uses vegetation greenness: green channel dominance over red.
    """
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
        pixels = list(img.getdata())
        r_vals = [p[0] for p in pixels if sum(p) > 30]
        g_vals = [p[1] for p in pixels if sum(p) > 30]
        if not r_vals:
            return 0.5
        avg_r = sum(r_vals) / len(r_vals)
        avg_g = sum(g_vals) / len(g_vals)
        ndvi_proxy = max(0.0, min(1.0, (avg_g - avg_r) / (avg_g + avg_r + 1e-6) + 0.5))
        return round(ndvi_proxy, 3)
    except Exception:
        return 0.5


def _esri_tile(lat: float, lon: float) -> dict:
    """
    Return an ESRI World Imagery tile URL for the location.
    Completely free, no key required. Used as fallback when Planet is unavailable.
    """
    import math
    zoom = 13
    n = 2 ** zoom
    x_tile = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y_tile = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)

    tile_url = (
        f"https://server.arcgisonline.com/ArcGIS/rest/services/"
        f"World_Imagery/MapServer/tile/{zoom}/{y_tile}/{x_tile}"
    )

    return {
        "source": "esri_world_imagery",
        "tile_url": tile_url,
        "image_b64": None,
        "ndvi_estimate": 0.6,
        "acquired_date": "Recent (ESRI composite)",
        "description": "ESRI World Imagery — Free satellite tiles (no key required)",
        "cached": False,
    }
