import asyncio
import httpx
import math
import sys
import os
import logging
from sqlalchemy.future import select

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.database import AsyncSessionLocal, MonitoredGridModel, init_db
from app.services.geo import get_location_name

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# NER Bounding Box
LAT_MIN = 22.0
LAT_MAX = 29.5
LON_MIN = 88.0
LON_MAX = 97.5
STEP = 0.15  # ~15km

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

async def fetch_elevations_batch(session, points):
    lats = ",".join(f"{p[0]:.4f}" for p in points)
    lons = ",".join(f"{p[1]:.4f}" for p in points)
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}"
    
    response = await session.get(url)
    if response.status_code == 200:
        data = response.json()
        return data.get("elevation", [0] * len(points))
    else:
        logger.error(f"Error fetching elevations: HTTP {response.status_code}")
        return [0] * len(points)

async def generate_grid():
    await init_db()
    
    logger.info("Generating grid points...")
    grid = []
    lat = LAT_MIN
    while lat <= LAT_MAX:
        lon = LON_MIN
        while lon <= LON_MAX:
            grid.append((round(lat, 4), round(lon, 4)))
            lon += STEP
        lat += STEP
    
    logger.info(f"Total grid points generated: {len(grid)}")
    
    # Fetch elevations in batches of 100
    elevations_dict = {}
    batch_size = 100
    async with httpx.AsyncClient(timeout=30.0) as session:
        for i in range(0, len(grid), batch_size):
            batch = grid[i:i + batch_size]
            elevs = await fetch_elevations_batch(session, batch)
            for pt, el in zip(batch, elevs):
                elevations_dict[pt] = el or 0
            logger.info(f"Fetched elevation for {i + len(batch)} / {len(grid)}")
            await asyncio.sleep(0.5)  # Rate limiting respect
            
    logger.info("Calculating slopes and filtering...")
    filtered_points = []
    
    for pt in grid:
        lat, lon = pt
        elev = elevations_dict[pt]
        
        # Approximate slope by checking right and bottom neighbors
        right_pt = (lat, round(lon + STEP, 4))
        bottom_pt = (round(lat - STEP, 4), lon)
        
        slope_deg = 0.0
        
        if right_pt in elevations_dict and bottom_pt in elevations_dict:
            elev_right = elevations_dict[right_pt]
            elev_bottom = elevations_dict[bottom_pt]
            
            # dz/dx (West-East)
            dist_x = haversine_distance(lat, lon, lat, lon + STEP)
            dz_dx = (elev_right - elev) / max(dist_x, 1)
            
            # dz/dy (North-South)
            dist_y = haversine_distance(lat, lon, lat - STEP, lon)
            dz_dy = (elev - elev_bottom) / max(dist_y, 1)
            
            # gradient magnitude
            gradient = math.sqrt(dz_dx**2 + dz_dy**2)
            slope_deg = math.degrees(math.atan(gradient))
            
        # Filter criteria: Hill areas (elev > 300) OR steep (slope > 15 deg)
        if elev > 300 or slope_deg > 15:
            filtered_points.append({
                "lat": lat,
                "lon": lon,
                "elevation": elev,
                "slope": slope_deg
            })
            
    logger.info(f"Filtered points (Hilly/Risk-Prone): {len(filtered_points)}")
    
    logger.info("Saving to database...")
    async with AsyncSessionLocal() as db:
        # Clear old grid
        await db.execute(MonitoredGridModel.__table__.delete())
        
        # Save new grid
        for i, pt in enumerate(filtered_points):
            location_name = get_location_name(pt["lat"], pt["lon"])
            db.add(MonitoredGridModel(
                lat=pt["lat"],
                lon=pt["lon"],
                elevation=pt["elevation"],
                slope=pt["slope"],
                location_name=location_name,
                last_risk_level="Pending"
            ))
            if i > 0 and i % 200 == 0:
                logger.info(f"Committing {i} points...")
                await db.commit()
                
        await db.commit()
        
    logger.info("Done! Grid generation complete.")

if __name__ == "__main__":
    asyncio.run(generate_grid())
