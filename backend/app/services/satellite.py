"""
Satellite Imagery Service
==========================
Fetches satellite image tiles for a given lat/lon location.

Priority chain:
  1. Sentinel Hub Process API  (requires free account key in .env)
     → True Colour (RGB) + NDVI composites from Sentinel-2 L2A
     → Sign up: https://www.sentinel-hub.com/develop/api/

  2. ESRI World Imagery (completely free, no key, tile-based)
     → Returns tile URL for display — no server-side processing needed

  3. OpenTopoMap (free, topographic tiles)
     → Good for slope/terrain context

The satellite panel in the frontend just displays the tile URL directly
for options 2 & 3 — no backend image download needed, saving bandwidth.

For Sentinel Hub (option 1), we fetch a small 256×256 PNG showing
true-color RGB of the selected area, returned as base64 for the frontend.
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
        "source": "sentinel_hub" | "esri" | "opentopomap",
        "tile_url": str,           # direct tile URL (for ESRI/topo fallbacks)
        "image_b64": str | None,   # base64 PNG (for Sentinel Hub)
        "ndvi_estimate": float,    # 0-1 vegetation estimate
        "acquired_date": str,      # approximate date of imagery
        "description": str,
    }
    """
    cache_key = f"satellite:{lat:.2f}:{lon:.2f}"
    cached = geo_cache.get(cache_key)
    if cached:
        return {**cached, "cached": True}

    # ── Option 1: Sentinel Hub ─────────────────────────────────────────────
    if settings.has_sentinel:
        result = await _fetch_sentinel_hub(lat, lon)
        if result:
            geo_cache.set(cache_key, result, ttl=3600)
            return result

    # ── Option 2: ESRI World Imagery tiles (always free) ──────────────────
    result = _esri_tile(lat, lon)
    geo_cache.set(cache_key, result, ttl=3600)
    return result


async def _fetch_sentinel_hub(lat: float, lon: float) -> dict | None:
    """
    Fetch a 256×256 true-colour PNG from Sentinel Hub Process API.
    Uses Sentinel-2 L2A (cloud-free composite from last 30 days).
    """
    # Step 1: Get OAuth token
    token = await _get_sentinel_token()
    if not token:
        return None

    # Bounding box: ±0.025° around the point (~2.5km at NER latitudes)
    delta = 0.025
    bbox = [lon - delta, lat - delta, lon + delta, lat + delta]

    # Evalscript: True Colour RGB
    evalscript = """
//VERSION=3
function setup() {
  return { input: ["B04","B03","B02","SCL"], output: { bands: 3 } };
}
function evaluatePixel(s) {
  // Simple cloud mask: SCL 3=cloud shadow, 8=cloud medium, 9=cloud high
  if ([3,8,9].includes(s.SCL[0])) return [0.5,0.5,0.5];
  return [3.5*s.B04[0], 3.5*s.B03[0], 3.5*s.B02[0]];
}
"""
    payload = {
        "input": {
            "bounds": {
                "bbox": bbox,
                "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"}
            },
            "data": [{
                "type": "sentinel-2-l2a",
                "dataFilter": {
                    "timeRange": {
                        "from": "2024-05-01T00:00:00Z",
                        "to": "2024-09-30T23:59:59Z",
                    },
                    "maxCloudCoverage": 40,
                    "mosaickingOrder": "mostRecent",
                }
            }]
        },
        "output": {
            "width": 256, "height": 256,
            "responses": [{"identifier": "default",
                           "format": {"type": "image/png"}}]
        },
        "evalscript": evalscript,
    }

    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                "https://services.sentinel-hub.com/api/v1/process",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()

        img_b64 = base64.b64encode(resp.content).decode("utf-8")
        ndvi_est = _estimate_ndvi_from_png(resp.content)

        logger.info(f"Sentinel Hub image fetched for {lat},{lon}")
        return {
            "source": "sentinel_hub",
            "tile_url": None,
            "image_b64": img_b64,
            "ndvi_estimate": ndvi_est,
            "acquired_date": "2024 (recent composite)",
            "description": "Sentinel-2 L2A True Colour (RGB) — 10m resolution",
            "cached": False,
        }
    except Exception as e:
        logger.warning(f"Sentinel Hub Process API failed: {e}")
        return None


async def _get_sentinel_token() -> str | None:
    """OAuth2 client credentials flow for Sentinel Hub."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                "https://services.sentinel-hub.com/oauth/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.SENTINELHUB_CLIENT_ID,
                    "client_secret": settings.SENTINELHUB_CLIENT_SECRET,
                },
            )
            resp.raise_for_status()
            return resp.json().get("access_token")
    except Exception as e:
        logger.warning(f"Sentinel Hub auth failed: {e}")
        return None


def _estimate_ndvi_from_png(png_bytes: bytes) -> float:
    """
    Rough NDVI proxy from a true-colour PNG.
    Uses vegetation greenness: green channel dominance over red.
    Not a true NDVI (needs NIR band), but useful as a quick proxy.
    """
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
        pixels = list(img.getdata())
        r_vals = [p[0] for p in pixels if sum(p) > 30]   # exclude black
        g_vals = [p[1] for p in pixels if sum(p) > 30]
        if not r_vals:
            return 0.5
        avg_r = sum(r_vals) / len(r_vals)
        avg_g = sum(g_vals) / len(g_vals)
        # Simple greenness index
        ndvi_proxy = max(0.0, min(1.0, (avg_g - avg_r) / (avg_g + avg_r + 1e-6) + 0.5))
        return round(ndvi_proxy, 3)
    except Exception:
        return 0.5


def _esri_tile(lat: float, lon: float) -> dict:
    """
    Return an ESRI World Imagery tile URL for the location.
    Completely free, no key required.
    The frontend can display this directly in an <img> or on the Leaflet map.
    Tile coordinates calculated from lat/lon at zoom level 13.
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
    # Static NDVI estimate from our geo service (region-based)
    ndvi_estimate = 0.6  # will be overridden by geo lookup at predict time

    return {
        "source": "esri_world_imagery",
        "tile_url": tile_url,
        "image_b64": None,
        "ndvi_estimate": ndvi_estimate,
        "acquired_date": "Recent (ESRI composite)",
        "description": "ESRI World Imagery — Free satellite tiles (no key required)",
        "cached": False,
    }
