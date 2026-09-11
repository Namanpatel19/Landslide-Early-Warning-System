"""
Pydantic schemas for the Landslide Early Warning API.
All request/response models are defined here for validation and docs.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class PredictRequest(BaseModel):
    """Request body for /predict endpoint."""
    lat: float = Field(..., ge=20.0, le=30.0, description="Latitude (NER bounds: 20-30°N)")
    lon: float = Field(..., ge=88.0, le=98.0, description="Longitude (NER bounds: 88-98°E)")
    location_name: Optional[str] = Field(None, description="Optional label for this location")


class FeatureValues(BaseModel):
    """Feature values used for prediction (returned for explainability)."""
    soil_type: str
    slope_angle: float
    elevation: float
    vegetation_index: float
    distance_to_mining_area: float
    distance_to_construction_area: float
    historical_landslide_zone: int
    rainfall_intensity_mm: float
    humidity: float
    temperature: float
    soil_moisture: float
    seismic_activity: float
    vibration_level: float  # Simulated — IoT sensor integration is future scope


class PredictResponse(BaseModel):
    """Response from /predict endpoint."""
    lat: float
    lon: float
    location_name: str
    risk_level: RiskLevel
    confidence: float = Field(..., ge=0.0, le=1.0)
    risk_score: float = Field(..., ge=0.0, le=1.0)
    features: FeatureValues
    top_factors: List[Dict[str, Any]]  # [{name: str, importance: float}] sorted desc
    timestamp: datetime
    cached: bool = False


class PredictionRecord(BaseModel):
    """Historical prediction stored in DB."""
    id: int
    lat: float
    lon: float
    location_name: str
    risk_level: str
    confidence: float
    risk_score: float
    timestamp: datetime

    class Config:
        from_attributes = True


class AlertRecord(BaseModel):
    """Alert log entry."""
    id: int
    lat: float
    lon: float
    location_name: str
    risk_level: str
    confidence: float
    top_factors: List[Dict[str, Any]]
    notified: bool
    timestamp: datetime

    class Config:
        from_attributes = True


class NotifyRequest(BaseModel):
    """Request to log an authority notification."""
    prediction_id: int
    method: str = "dashboard"  # Future: sms, push, email


class HistoryResponse(BaseModel):
    records: List[PredictionRecord]
    total: int


class AlertsResponse(BaseModel):
    alerts: List[AlertRecord]
    total: int
