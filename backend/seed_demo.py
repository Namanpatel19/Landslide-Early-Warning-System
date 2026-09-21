import asyncio
from app.database import AsyncSessionLocal, MonitoredGridModel, init_db

# 5 well-known high-risk hilly regions in NER
demo_points = [
    {"lat": 25.57, "lon": 91.88, "location_name": "Shillong, Meghalaya", "elevation": 1496.0, "slope": 25.0},
    {"lat": 26.18, "lon": 92.94, "location_name": "Guwahati, Assam", "elevation": 55.0, "slope": 18.0},
    {"lat": 23.73, "lon": 92.71, "location_name": "Aizawl, Mizoram", "elevation": 1132.0, "slope": 30.0},
    {"lat": 27.33, "lon": 88.61, "location_name": "Gangtok, Sikkim", "elevation": 1650.0, "slope": 35.0},
    {"lat": 25.67, "lon": 94.10, "location_name": "Kohima, Nagaland", "elevation": 1444.0, "slope": 28.0}
]

async def seed_demo_points():
    await init_db()
    async with AsyncSessionLocal() as db:
        print("Clearing old grid and inserting 5 high-risk NER points for demo...")
        await db.execute(MonitoredGridModel.__table__.delete())
        
        for pt in demo_points:
            db.add(MonitoredGridModel(
                lat=pt["lat"],
                lon=pt["lon"],
                elevation=pt["elevation"],
                slope=pt["slope"],
                location_name=pt["location_name"],
                last_risk_level="Pending"
            ))
        await db.commit()
    print("Demo points seeded successfully! The background sweeper will pick these up within 2 minutes.")

if __name__ == "__main__":
    asyncio.run(seed_demo_points())
