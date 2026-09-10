"""
ML Inference Module — Landslide Risk Prediction
================================================
Loads trained artifacts and runs fast inference.
All model loading happens once at startup (FastAPI lifespan).
Inference is pure numpy/sklearn — sub-millisecond for single prediction.
"""

import json
import logging
import random
from pathlib import Path
from typing import Optional
import numpy as np
import joblib

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent.parent.parent / "models"

SOIL_TYPE_ORDER = ["rocky", "sandy_loam", "loam", "laterite", "silt", "clay"]
RISK_ORDER = ["Low", "Medium", "High", "Critical"]

# ─── Global Model State ───────────────────────────────────────────────────────
# Loaded once at startup via load_model()
_clf = None
_scaler = None
_label_encoder = None
_ordinal_encoder = None
_feature_names = None
_feature_importances: dict = {}


def load_model() -> bool:
    """
    Load all model artifacts from disk.
    Called once at FastAPI startup.
    Returns True if successful, False if models not found (needs training).
    """
    global _clf, _scaler, _label_encoder, _ordinal_encoder, _feature_names, _feature_importances

    required_files = ["model.pkl", "scaler.pkl", "label_encoder.pkl",
                      "ordinal_encoder.pkl", "feature_names.pkl"]

    for f in required_files:
        if not (MODELS_DIR / f).exists():
            logger.error(f"Model file missing: {MODELS_DIR / f}. Run train_model.py first.")
            return False

    _clf = joblib.load(MODELS_DIR / "model.pkl")
    _scaler = joblib.load(MODELS_DIR / "scaler.pkl")
    _label_encoder = joblib.load(MODELS_DIR / "label_encoder.pkl")
    _ordinal_encoder = joblib.load(MODELS_DIR / "ordinal_encoder.pkl")
    _feature_names = joblib.load(MODELS_DIR / "feature_names.pkl")

    importance_file = MODELS_DIR / "feature_importances.json"
    if importance_file.exists():
        with open(importance_file) as f:
            _feature_importances = json.load(f)

    logger.info(f"✅ Model loaded: {_clf.__class__.__name__} with "
                f"{_clf.n_estimators} estimators")
    return True


def is_model_loaded() -> bool:
    return _clf is not None


def _simulate_vibration() -> float:
    """
    Simulate IoT vibration sensor reading.
    NOTE: In production, this would be a real-time reading from
    LoRa/GSM-connected accelerometers deployed on hillsides.
    Future scope: Integrate with IoT platform (AWS IoT / Thingsboard).
    """
    # Realistic distribution: mostly low vibration with occasional spikes
    return round(np.random.exponential(scale=1.5), 2)


def build_feature_vector(
    soil_type: str,
    slope_angle: float,
    elevation: float,
    vegetation_index: float,
    distance_to_mining_area: float,
    distance_to_construction_area: float,
    historical_landslide_zone: int,
    rainfall_intensity_mm: float,
    humidity: float,
    temperature: float,
    soil_moisture: float,
    seismic_activity: float,
    vibration_level: Optional[float] = None,
) -> np.ndarray:
    """
    Assemble and scale feature vector for model inference.
    Order must match training feature_names list.
    """
    if vibration_level is None:
        vibration_level = _simulate_vibration()

    # Ordinal encode soil type (must match training encoding)
    soil_enc = _ordinal_encoder.transform([[soil_type]])[0][0]

    numeric = [
        slope_angle,
        elevation,
        vegetation_index,
        distance_to_mining_area,
        distance_to_construction_area,
        float(historical_landslide_zone),
        rainfall_intensity_mm,
        humidity,
        temperature,
        soil_moisture,
        seismic_activity,
        vibration_level,
        soil_enc,  # soil_type_enc is last (matches training order)
    ]

    X = np.array(numeric, dtype=np.float64).reshape(1, -1)
    X_scaled = _scaler.transform(X)
    return X_scaled, vibration_level


def predict(features: dict) -> dict:
    """
    Run inference and return risk level, confidence, score, and top factors.
    
    Returns:
        {
            risk_level: str,
            confidence: float,
            risk_score: float,
            top_factors: [{name, importance}],
            vibration_level: float
        }
    """
    if not is_model_loaded():
        raise RuntimeError("Model not loaded. Run train_model.py first.")

    X_scaled, vibration_level = build_feature_vector(
        soil_type=features["soil_type"],
        slope_angle=features["slope_angle"],
        elevation=features["elevation"],
        vegetation_index=features["vegetation_index"],
        distance_to_mining_area=features["distance_to_mining_area"],
        distance_to_construction_area=features["distance_to_construction_area"],
        historical_landslide_zone=features["historical_landslide_zone"],
        rainfall_intensity_mm=features["rainfall_intensity_mm"],
        humidity=features["humidity"],
        temperature=features["temperature"],
        soil_moisture=features["soil_moisture"],
        seismic_activity=features["seismic_activity"],
        vibration_level=features.get("vibration_level"),
    )

    # --- Fast inference (<1ms for RandomForest) ---
    proba = _clf.predict_proba(X_scaled)[0]          # shape: (n_trained_classes,)
    predicted_class_idx = int(np.argmax(proba))
    confidence = float(proba[predicted_class_idx])

    # clf.classes_ holds the integer class labels the model was actually trained on
    # (may be [0,1,2] if Critical was absent from training data, not [0,1,2,3])
    trained_class_ints = _clf.classes_               # e.g. [0, 1, 2] or [0, 1, 2, 3]

    # Map predicted integer back to risk label string
    full_severity = {0: 0.0, 1: 0.33, 2: 0.67, 3: 1.0}  # Low→0, Med→0.33, High→0.67, Crit→1.0
    risk_level = RISK_ORDER[trained_class_ints[predicted_class_idx]]

    # Composite risk score: dot product of class probabilities × severity weights
    # Build severity_weights aligned to trained_class_ints (not hardcoded to 4)
    severity_weights = np.array([full_severity[int(c)] for c in trained_class_ints])
    risk_score = float(np.dot(proba, severity_weights))

    # Top contributing factors from global feature importance
    top_factors = [
        {"name": k, "importance": round(v, 4)}
        for k, v in list(_feature_importances.items())[:6]
    ]

    return {
        "risk_level": risk_level,
        "confidence": confidence,
        "risk_score": risk_score,
        "top_factors": top_factors,
        "vibration_level": vibration_level,
    }
