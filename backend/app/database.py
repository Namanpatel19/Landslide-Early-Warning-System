"""
SQLite Database setup using SQLAlchemy (async).
Tables:
  - predictions : all /predict calls (for history/trend)
  - alerts      : High/Critical predictions flagged as alerts
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text
from datetime import datetime, timezone
import json

DATABASE_URL = "sqlite+aiosqlite:///./landslide.db"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class PredictionModel(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    location_name = Column(String(200), default="Unknown")
    risk_level = Column(String(20), nullable=False)
    confidence = Column(Float, nullable=False)
    risk_score = Column(Float, nullable=False)
    features_json = Column(Text)  # serialized feature dict
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AlertModel(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    location_name = Column(String(200), default="Unknown")
    risk_level = Column(String(20), nullable=False)
    confidence = Column(Float, nullable=False)
    top_factors_json = Column(Text)  # serialized list of {name, importance}
    notified = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """Dependency injector for AsyncSession."""
    async with AsyncSessionLocal() as session:
        yield session
