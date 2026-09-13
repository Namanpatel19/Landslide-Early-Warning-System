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


import math
import shap

# Initialize SHAP explainer once
_explainer = None

def is_model_loaded() -> bool:
    """Returns True if the ML model is currently loaded in memory."""
    global _clf
    return _clf is not None

def _simulate_vibration() -> float:
    """Simulate a vibration level (e.g. between 0.0 and 0.5) if IoT sensors are unavailable."""
    import random
    return round(random.uniform(0.0, 0.5), 2)

def load_model() -> bool:
    """
    Load all model artifacts from disk.
    Called once at FastAPI startup.
    Returns True if successful, False if models not found (needs training).
    """
    global _clf, _scaler, _label_encoder, _ordinal_encoder, _feature_names, _feature_importances, _explainer

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

    # Initialize SHAP Explainer
    # TreeExplainer is extremely fast for Random Forest
    try:
        _explainer = shap.TreeExplainer(_clf)
    except Exception as e:
        logger.error(f"Could not initialize SHAP explainer: {e}")

    logger.info(f"✅ Model loaded: {_clf.__class__.__name__} with "
                f"{_clf.n_estimators} estimators")
    return True

def calculate_fs(slope_angle_deg, soil_type, soil_moisture, rainfall_last_15_days):
    """
    Infinite slope Factor of Safety (FS) approximation.
    """
    # Standard properties
    soil_props = {
        "rocky": {"c": 50, "phi": 35, "gamma": 22},
        "sandy_loam": {"c": 10, "phi": 30, "gamma": 18},
        "loam": {"c": 15, "phi": 28, "gamma": 17},
        "laterite": {"c": 25, "phi": 32, "gamma": 19},
        "silt": {"c": 5, "phi": 25, "gamma": 16},
        "clay": {"c": 20, "phi": 20, "gamma": 16},
    }
    props = soil_props.get(soil_type, soil_props["loam"])
    c = props["c"]
    phi = math.radians(props["phi"])
    gamma_s = props["gamma"]
    gamma_w = 9.81
    
    z = 2.0 # Assume 2m soil depth
    
    # Estimate water table depth 'h' (0 to 2m) based on soil moisture and 15d rainfall saturation
    saturation = min(1.0, soil_moisture + (rainfall_last_15_days / 600.0))
    h = z * saturation
    
    beta = math.radians(slope_angle_deg)
    
    if beta < 0.05:
        return 10.0 # Stable
        
    # Formula: FS = [ c + (gamma_s * z - gamma_w * h) * cos^2(beta) * tan(phi) ] / [ gamma_s * z * sin(beta) * cos(beta) ]
    numerator = c + (gamma_s * z - gamma_w * h) * (math.cos(beta)**2) * math.tan(phi)
    denominator = gamma_s * z * math.sin(beta) * math.cos(beta)
    
    if denominator <= 0:
        return 10.0
        
    fs = numerator / denominator
    return max(0.1, min(10.0, fs))

def build_feature_vector(
    soil_type: str,
    slope_angle: float,
    elevation: float,
    vegetation_index: float,
    distance_to_mining_area: float,
    distance_to_construction_area: float,
    historical_landslide_zone: int,
    rainfall_intensity_mm: float,
    rainfall_last_3_days: float,
    rainfall_last_7_days: float,
    rainfall_last_15_days: float,
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
        rainfall_last_3_days,
        rainfall_last_7_days,
        rainfall_last_15_days,
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
        rainfall_last_3_days=features.get("rainfall_last_3_days", 0.0),
        rainfall_last_7_days=features.get("rainfall_last_7_days", 0.0),
        rainfall_last_15_days=features.get("rainfall_last_15_days", 0.0),
        humidity=features["humidity"],
        temperature=features["temperature"],
        soil_moisture=features["soil_moisture"],
        seismic_activity=features["seismic_activity"],
        vibration_level=features.get("vibration_level"),
    )

    # --- Fast inference (<1ms for RandomForest) ---
    proba = _clf.predict_proba(X_scaled)[0]
    predicted_class_idx = int(np.argmax(proba))
    confidence = float(proba[predicted_class_idx])

    trained_class_ints = _clf.classes_
    full_severity = {0: 0.0, 1: 0.33, 2: 0.67, 3: 1.0}
    ml_risk_score = float(np.dot(proba, np.array([full_severity[int(c)] for c in trained_class_ints])))

    # Physics-Based Factor of Safety (FS)
    fs = calculate_fs(
        slope_angle_deg=features["slope_angle"],
        soil_type=features["soil_type"],
        soil_moisture=features["soil_moisture"],
        rainfall_last_15_days=features.get("rainfall_last_15_days", 0.0)
    )
    
    # Map FS to physics_risk score [0, 1]
    # If FS <= 1.0 -> 1.0 (Critical)
    # If FS >= 2.0 -> 0.0 (Safe)
    physics_risk = np.clip(2.0 - fs, 0.0, 1.0)
    
    # Hybrid Risk Score
    risk_score = 0.7 * ml_risk_score + 0.3 * physics_risk
    
    # Determine risk level based on hybrid score
    if risk_score >= 0.86:
        risk_level = "Critical"
    elif risk_score >= 0.66:
        risk_level = "High"
    elif risk_score >= 0.41:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    # Explainability with SHAP
    top_factors = []
    if _explainer:
        try:
            shap_vals = _explainer.shap_values(X_scaled)
            # shap_vals is a list of arrays (one per class). We take the values for the predicted class.
            class_shap = shap_vals[predicted_class_idx][0]
            
            # Pair feature names with their local SHAP importance
            feat_impact = []
            for i, feat_name in enumerate(_feature_names):
                val = class_shap[i]
                if abs(val) > 0.001:
                    feat_impact.append({"name": feat_name, "importance": round(val, 4)})
                    
            # Sort by absolute impact magnitude
            feat_impact.sort(key=lambda x: abs(x["importance"]), reverse=True)
            top_factors = feat_impact[:6]
        except Exception as e:
            logger.warning(f"SHAP explanation failed: {e}")
            
    # Fallback to global importance if SHAP fails or is empty
    if not top_factors:
        top_factors = [
            {"name": k, "importance": round(v, 4)}
            for k, v in list(_feature_importances.items())[:6]
        ]

    return {
        "risk_level": risk_level,
        "confidence": confidence,
        "risk_score": risk_score,
        "physics_fs": round(fs, 2),
        "top_factors": top_factors,
        "vibration_level": vibration_level,
    }
