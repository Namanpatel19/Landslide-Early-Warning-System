"""
Satellite Router — /satellite endpoint
Returns satellite imagery data for a given location.
"""

import base64
from fastapi import APIRouter, Query, HTTPException
from ..services.satellite import get_satellite_data
from ..services.geocoding import reverse_geocode

router = APIRouter(prefix="/satellite", tags=["Satellite"])


@router.get("")
async def get_satellite(
    lat: float = Query(..., ge=20.0, le=30.0),
    lon: float = Query(..., ge=88.0, le=98.0),
):
    """
    Fetch satellite imagery for a NER location.
    
    Source priority:
      1. Sentinel Hub (if SENTINELHUB_CLIENT_ID + SECRET set in .env)
         → Returns base64-encoded 256×256 PNG
      2. ESRI World Imagery (always free, no key)
         → Returns tile URL for direct browser rendering
    """
    if not (20 <= lat <= 30 and 88 <= lon <= 98):
        raise HTTPException(400, "Coordinates out of Northeast India bounds")

    data = await get_satellite_data(lat, lon)
    location = await reverse_geocode(lat, lon)

    return {
        **data,
        "lat": lat,
        "lon": lon,
        "location_name": location,
    }
