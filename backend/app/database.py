"""
SQLite Database setup using SQLAlchemy (async).
Tables:
  - predictions : all /predict calls (for history/trend)
  - alerts      : High/Critical predictions flagged as alerts
  - public_reports: Crowdsourced reports uploaded by users
  - auto_scanned: Latest results from the background sweep
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text, UniqueConstraint
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
    risk_score = Column(Float, nullable=True)  # Added for NaN bug
    top_factors_json = Column(Text)  # serialized list of {name, importance}
    notified = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AuthorityContactModel(Base):
    __tablename__ = "authority_contacts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    phone_number = Column(String(20), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)


class PublicAlertModel(Base):
    """Simple safety notifications for citizens."""
    __tablename__ = "public_alerts"

    id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String(200), default="Unknown")
    message = Column(String(500), nullable=False)
    is_active = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SmsLogModel(Base):
    """Log of all sent SMS alerts."""
    __tablename__ = "sms_log"

    id = Column(Integer, primary_key=True, index=True)
    recipient = Column(String(20), nullable=False)
    message = Column(String(500), nullable=False)
    status = Column(String(50), default="pending")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PublicReportModel(Base):
    __tablename__ = "public_reports"

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String(500), nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    location_name = Column(String(200), default="Unknown")
    has_exif_gps = Column(Boolean, default=False)
    report_type = Column(String(50), default="Other")
    gemini_analysis = Column(Text, nullable=True)  # JSON or text from Gemini
    severity = Column(String(20), default="Pending") # Pending, Low, Medium, High, Critical, False Report
    status = Column(String(20), default="pending") # pending, verified, rejected
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class TruePositiveModel(Base):
    """Stores historical true positives (landslides that actually occurred) for RAG"""
    __tablename__ = "true_positives"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    location_name = Column(String(200))
    risk_level = Column(String(20))
    confidence = Column(Float)
    features_json = Column(Text) # The weather/geo conditions at the time
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AutoScannedLocationModel(Base):
    """Stores the latest sweep result for a critical location"""
    __tablename__ = "auto_scanned"
    
    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False, index=True)
    lon = Column(Float, nullable=False, index=True)
    location_name = Column(String(200))
    risk_level = Column(String(20))
    confidence = Column(Float)
    risk_score = Column(Float)
    features_json = Column(Text)
    gemini_explanation = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class MonitoredGridModel(Base):
    """Stores dynamically generated grid points for sweeping."""
    __tablename__ = "monitored_grid"
    __table_args__ = (UniqueConstraint('lat', 'lon', name='uix_lat_lon'),)
    
    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False, index=True)
    lon = Column(Float, nullable=False, index=True)
    location_name = Column(String(200))
    elevation = Column(Float)
    slope = Column(Float)
    last_synced = Column(DateTime, nullable=True)
    last_risk_level = Column(String(20), default="Pending")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))



async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """Dependency injector for AsyncSession."""
    async with AsyncSessionLocal() as session:
        yield session
