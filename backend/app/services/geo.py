"""
Geo Service — Elevation, Slope, and Soil Data for NER
======================================================
Provides static geological features for a given lat/lon.

Data Sources used:
  - Elevation/slope: approximated from known NER terrain profiles
    (production: use OpenTopography SRTM API or Copernicus DEM)
  - Soil type: regional lookup based on NER soil surveys
    (production: use SoilGrids ISRIC REST API)
  - Land use: NDVI proxy from regional zones

NOTE: For demo/hackathon, we use a region-based lookup table
calibrated from published NER geological surveys. This gives
realistic values without requiring paid API keys.

Future scope: Replace with:
  - OpenTopography API (free tier: 500 req/day)
  - SoilGrids ISRIC API (completely free)
  - MODIS NDVI via NASA POWER API
"""

import math
import random
import logging
from .cache import geo_cache

logger = logging.getLogger(__name__)


# ─── NER Sub-Region Definitions ──────────────────────────────────────────────
# Each region has characteristic slope, elevation, soil, NDVI ranges
# Based on: GSI (Geological Survey of India) NER reports

NER_REGIONS = [
    {
        "name": "Eastern Himalayas (Sikkim/Arunachal foothills)",
        "lat_range": (26.5, 29.5), "lon_range": (88.0, 95.0),
        "slope_mean": 38, "slope_std": 12,
        "elev_mean": 1800, "elev_std": 800,
        "ndvi_mean": 0.65, "ndvi_std": 0.15,
        "soil_types": ["clay", "loam", "rocky"],
        "soil_weights": [0.40, 0.35, 0.25],
        "historical_zone_prob": 0.55,
        "mining_dist_mean": 30, "construction_dist_mean": 20,
    },
    {
        "name": "Meghalaya Plateau",
        "lat_range": (24.5, 26.5), "lon_range": (89.5, 93.0),
        "slope_mean": 25, "slope_std": 8,
        "elev_mean": 900, "elev_std": 300,
        "ndvi_mean": 0.70, "ndvi_std": 0.12,
        "soil_types": ["laterite", "sandy_loam", "loam"],
        "soil_weights": [0.45, 0.30, 0.25],
        "historical_zone_prob": 0.45,
        "mining_dist_mean": 8, "construction_dist_mean": 12,  # Mining common in Meghalaya
    },
    {
        "name": "Assam Valley / Brahmaputra Plains",
        "lat_range": (25.5, 27.5), "lon_range": (89.5, 96.0),
        "slope_mean": 5, "slope_std": 3,
        "elev_mean": 80, "elev_std": 30,
        "ndvi_mean": 0.55, "ndvi_std": 0.20,
        "soil_types": ["silt", "clay", "loam"],
        "soil_weights": [0.50, 0.30, 0.20],
        "historical_zone_prob": 0.20,
        "mining_dist_mean": 40, "construction_dist_mean": 8,
    },
    {
        "name": "Manipur/Nagaland Hills",
        "lat_range": (23.5, 26.5), "lon_range": (92.5, 96.5),
        "slope_mean": 32, "slope_std": 10,
        "elev_mean": 1200, "elev_std": 500,
        "ndvi_mean": 0.60, "ndvi_std": 0.18,
        "soil_types": ["clay", "silt", "loam"],
        "soil_weights": [0.35, 0.35, 0.30],
        "historical_zone_prob": 0.50,
        "mining_dist_mean": 20, "construction_dist_mean": 15,
    },
    {
        "name": "Mizoram Hills",
        "lat_range": (21.5, 24.5), "lon_range": (92.0, 93.5),
        "slope_mean": 30, "slope_std": 9,
        "elev_mean": 1000, "elev_std": 400,
        "ndvi_mean": 0.68, "ndvi_std": 0.14,
        "soil_types": ["loam", "clay", "laterite"],
        "soil_weights": [0.40, 0.35, 0.25],
        "historical_zone_prob": 0.42,
        "mining_dist_mean": 35, "construction_dist_mean": 18,
    },
    {
        "name": "Tripura",
        "lat_range": (22.5, 24.5), "lon_range": (91.0, 92.5),
        "slope_mean": 15, "slope_std": 6,
        "elev_mean": 350, "elev_std": 150,
        "ndvi_mean": 0.62, "ndvi_std": 0.16,
        "soil_types": ["loam", "silt", "clay"],
        "soil_weights": [0.40, 0.35, 0.25],
        "historical_zone_prob": 0.35,
        "mining_dist_mean": 45, "construction_dist_mean": 10,
    },
]

# Default region if lat/lon doesn't match any specific region
DEFAULT_REGION = {
    "name": "Northeast India",
    "slope_mean": 22, "slope_std": 10,
    "elev_mean": 700, "elev_std": 400,
    "ndvi_mean": 0.62, "ndvi_std": 0.15,
    "soil_types": ["loam", "clay", "silt"],
    "soil_weights": [0.40, 0.35, 0.25],
    "historical_zone_prob": 0.40,
    "mining_dist_mean": 25, "construction_dist_mean": 15,
}


def _get_region(lat: float, lon: float) -> dict:
    """Find the NER sub-region for given coordinates."""
    for region in NER_REGIONS:
        if (region["lat_range"][0] <= lat <= region["lat_range"][1] and
                region["lon_range"][0] <= lon <= region["lon_range"][1]):
            return region
    return DEFAULT_REGION


def fetch_geo_features(lat: float, lon: float) -> dict:
    """
    Return static geological features for the given location.
    Uses seeded random based on lat/lon for deterministic output
    (same location always returns same static features — realistic for
    geological data which doesn't change quickly).
    """
    cache_key = f"geo:{lat:.3f}:{lon:.3f}"
    cached = geo_cache.get(cache_key)
    if cached:
        return cached

    region = _get_region(lat, lon)

    # Seed based on location for deterministic (but varied) static features
    seed = int(abs(lat * 1000) + abs(lon * 1000)) % 2**31
    rng = random.Random(seed)

    slope = max(1.0, min(70.0, rng.gauss(region["slope_mean"], region["slope_std"])))
    elevation = max(50.0, min(3500.0, rng.gauss(region["elev_mean"], region["elev_std"])))
    ndvi = max(0.05, min(0.95, rng.gauss(region["ndvi_mean"], region["ndvi_std"])))
    soil_type = rng.choices(region["soil_types"], weights=region["soil_weights"])[0]
    historical_zone = 1 if rng.random() < region["historical_zone_prob"] else 0
    mining_dist = max(0.5, rng.expovariate(1.0 / region["mining_dist_mean"]))
    construction_dist = max(0.5, rng.expovariate(1.0 / region["construction_dist_mean"]))

    # Simulate Population Density (Proxy for WorldPop API or actual API fallback)
    # NER has scattered villages and some dense valleys.
    # We correlate it loosely with construction distance for realism.
    pop_density = max(10, min(5000, rng.gauss(500, 200) * (30 / max(1, construction_dist))))

    result = {
        "soil_type": soil_type,
        "slope_angle": round(slope, 2),
        "elevation": round(elevation, 1),
        "vegetation_index": round(ndvi, 3),
        "distance_to_mining_area": round(min(mining_dist, 80.0), 2),
        "distance_to_construction_area": round(min(construction_dist, 60.0), 2),
        "historical_landslide_zone": historical_zone,
        "region_name": region["name"],
        "population_density": int(pop_density),
    }

    geo_cache.set(cache_key, result)
    logger.info(f"Geo features for {lat},{lon}: region={region['name']}, slope={slope:.1f}°")
    return result


def get_location_name(lat: float, lon: float) -> str:
    """
    Generate a descriptive location name from coordinates.
    In production: use OpenCage/Nominatim reverse geocoding (free).
    """
    region = _get_region(lat, lon)
    # Round to 3 decimal places for display
    return f"{region['name']} ({lat:.4f}°N, {lon:.4f}°E)"
