"""
Synthetic Training Data Generator for Landslide Early Warning System
Northeast India (NER) — SIH Prototype

Generates realistic synthetic data based on:
- Known geology of NER (high rainfall, steep terrain, seismically active)
- Domain knowledge from published landslide studies in Assam, Meghalaya,
  Manipur, Sikkim, and Nagaland
"""

import numpy as np
import pandas as pd
from pathlib import Path

# Set random seed for reproducibility
np.random.seed(42)

N_SAMPLES = 6000

def generate_dataset(n: int = N_SAMPLES) -> pd.DataFrame:
    """Generate synthetic landslide training data for NER."""
    
    # --- Static Features ---
    # Soil types common in NER (affects water retention & stability)
    soil_types = ["clay", "loam", "sandy_loam", "silt", "rocky", "laterite"]
    soil_weights = [0.25, 0.20, 0.15, 0.20, 0.10, 0.10]  # realistic distribution
    soil_type = np.random.choice(soil_types, size=n, p=soil_weights)

    # Slope angle (degrees) — NER is hilly; most landslides on 20-55° slopes
    slope_angle = np.random.gamma(shape=3.0, scale=9.0, size=n).clip(1, 70)

    # Elevation (meters) — NER ranges from plains (~50m) to Himalayan foothills (~3000m)
    elevation = np.random.gamma(shape=2.5, scale=400, size=n).clip(50, 3500)

    # NDVI proxy (0-1): 0=barren, 1=dense forest. Lower = higher risk
    vegetation_index = np.random.beta(a=3, b=2, size=n)

    # Distance to nearest mining area (km)
    distance_to_mining_area = np.random.exponential(scale=15, size=n).clip(0.5, 80)

    # Distance to nearest construction (km)
    distance_to_construction_area = np.random.exponential(scale=10, size=n).clip(0.5, 60)

    # Whether the point is in a historically active landslide zone
    historical_landslide_zone = np.random.binomial(n=1, p=0.35, size=n)

    # --- Dynamic Features (Weather/Environmental Triggers) ---
    # Rainfall intensity (mm/day) — monsoon season drives most landslides in NER
    # High rainfall is the #1 trigger in Meghalaya/Assam
    rainfall_intensity_mm = np.random.gamma(shape=1.8, scale=18, size=n).clip(0, 250)

    # Humidity (%)
    humidity = np.random.normal(loc=78, scale=12, size=n).clip(30, 100)

    # Temperature (°C)
    temperature = np.random.normal(loc=22, scale=6, size=n).clip(5, 38)

    # Soil moisture (0-1)
    soil_moisture = np.random.beta(a=2.5, b=2, size=n)

    # Seismic activity (magnitude proxy) — NER is in seismic Zone V
    # Most readings near 0, occasional moderate events
    seismic_activity = np.random.exponential(scale=0.5, size=n).clip(0, 6.5)

    # Vibration level (0-10) — simulates IoT sensor data
    # NOTE: In production, this would come from real IoT vibration sensors
    # Future scope: integrate with LoRa/GSM-based sensor network
    vibration_level = np.random.exponential(scale=1.5, size=n).clip(0, 10)

    df = pd.DataFrame({
        "soil_type": soil_type,
        "slope_angle": slope_angle,
        "elevation": elevation,
        "vegetation_index": vegetation_index,
        "distance_to_mining_area": distance_to_mining_area,
        "distance_to_construction_area": distance_to_construction_area,
        "historical_landslide_zone": historical_landslide_zone,
        "rainfall_intensity_mm": rainfall_intensity_mm,
        "humidity": humidity,
        "temperature": temperature,
        "soil_moisture": soil_moisture,
        "seismic_activity": seismic_activity,
        "vibration_level": vibration_level,
    })

    # --- Label Engineering ---
    # Physics-based risk score combining domain knowledge weights.
    # Weights are based on NER landslide literature (GSI reports, NDMA studies).
    #
    # NOTE: The score is normalised to [0, 1] using the PRACTICAL maximum of each
    # feature under realistic NER monsoon conditions — not the theoretical max.
    # This ensures scores spread across the full [0, 1] range so all four risk
    # classes are populated.

    # Soil type risk penalty (clay/silt retain water → higher risk)
    soil_penalty = np.where(
        soil_type == "clay", 1.0,
        np.where(soil_type == "silt", 0.85,
        np.where(soil_type == "loam", 0.65,
        np.where(soil_type == "laterite", 0.55,
        np.where(soil_type == "sandy_loam", 0.40, 0.25))))  # rocky = lowest
    )

    risk_score = (
        0.25 * np.clip(rainfall_intensity_mm / 150, 0, 1)    # Normalise to typical monsoon max
        + 0.15 * np.clip(slope_angle / 55, 0, 1)             # 55° is a realistic steep NER slope
        + 0.12 * soil_moisture                                # Already [0,1]
        + 0.10 * (1 - vegetation_index)                      # Low NDVI = deforested = higher risk
        + 0.08 * np.clip(seismic_activity / 4.5, 0, 1)       # NER typical M<4.5 events
        + 0.08 * historical_landslide_zone
        + 0.07 * np.clip(vibration_level / 7, 0, 1)          # Practical sensor max
        + 0.05 * np.clip((humidity - 40) / 55, 0, 1)         # Meaningful range: 40-95%
        + 0.05 * soil_penalty
        + 0.03 * np.clip(1 - distance_to_mining_area / 40, 0, 1)     # Risk within 40km
        + 0.02 * np.clip(1 - distance_to_construction_area / 30, 0, 1)
    )

    # Add realistic observational noise
    risk_score += np.random.normal(0, 0.03, n)
    risk_score = risk_score.clip(0, 1)

    # --- Calibrated thresholds for realistic NER class distribution ---
    # Target approximate split: Low ~25%, Medium ~45%, High ~20%, Critical ~10%
    # Thresholds derived from percentile analysis of the score distribution.
    risk_label = pd.cut(
        risk_score,
        bins=[-np.inf, 0.28, 0.48, 0.63, np.inf],
        labels=["Low", "Medium", "High", "Critical"]
    )

    df["risk_level"] = risk_label
    df["risk_score"] = risk_score

    return df


if __name__ == "__main__":
    out_dir = Path(__file__).parent.parent / "data"
    out_dir.mkdir(exist_ok=True)
    
    df = generate_dataset()
    out_path = out_dir / "landslide_training_data.csv"
    df.to_csv(out_path, index=False)
    
    print(f"✅ Generated {len(df)} training samples → {out_path}")
    print("\n📊 Class Distribution:")
    print(df["risk_level"].value_counts().sort_index())
    print("\n📈 Feature Statistics:")
    print(df.describe().round(2))
