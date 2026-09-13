import os
import sys
import pandas as pd
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.ml.model import load_model, predict

# Test cases
scenarios = [
    {
        "name": "Flat Safe (Plains, Low Rain)",
        "features": {
            "soil_type": "rocky", "slope_angle": 5.0, "elevation": 100.0,
            "vegetation_index": 0.8, "distance_to_mining_area": 50.0, "distance_to_construction_area": 50.0,
            "historical_landslide_zone": 0, "rainfall_intensity_mm": 5.0, "humidity": 50.0,
            "temperature": 25.0, "soil_moisture": 0.2, "seismic_activity": 0.0, "vibration_level": 0.5
        }
    },
    {
        "name": "Moderate Risk (Hilly, Moderate Rain)",
        "features": {
            "soil_type": "loam", "slope_angle": 25.0, "elevation": 1000.0,
            "vegetation_index": 0.5, "distance_to_mining_area": 20.0, "distance_to_construction_area": 15.0,
            "historical_landslide_zone": 0, "rainfall_intensity_mm": 40.0, "humidity": 75.0,
            "temperature": 22.0, "soil_moisture": 0.5, "seismic_activity": 1.5, "vibration_level": 2.0
        }
    },
    {
        "name": "Extreme Risk (Steep, Heavy Rain, Clay)",
        "features": {
            "soil_type": "clay", "slope_angle": 50.0, "elevation": 2000.0,
            "vegetation_index": 0.2, "distance_to_mining_area": 5.0, "distance_to_construction_area": 2.0,
            "historical_landslide_zone": 1, "rainfall_intensity_mm": 150.0, "humidity": 95.0,
            "temperature": 20.0, "soil_moisture": 0.9, "seismic_activity": 4.5, "vibration_level": 7.0
        }
    }
]

if not load_model():
    print("Model not loaded!")
    sys.exit(1)

for s in scenarios:
    print(f"\n--- {s['name']} ---")
    res = predict(s["features"])
    print(f"Risk Level: {res['risk_level']}")
    print(f"Confidence: {res['confidence'] * 100:.1f}%")
    print(f"Risk Score: {res['risk_score']:.3f}")
    
    # Let's also print the raw scaled features that were generated in `build_feature_vector`
    from app.ml.model import build_feature_vector
    X_scaled, _ = build_feature_vector(**s["features"])
    print(f"Scaled X: {X_scaled[0][:5]}...")
