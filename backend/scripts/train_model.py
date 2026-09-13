"""
ML Training Pipeline — Landslide Early Warning System (SIH)
============================================================
Trains a RandomForestClassifier on real NER landslide data.

Data priority:
  1. data/landslide_training_data.csv  (built by fetch_real_data.py)
  2. Fallback: generate_data.py        (calibrated synthetic data)

Saves to models/:
  model.pkl            → trained RandomForestClassifier
  scaler.pkl           → StandardScaler for numeric features
  label_encoder.pkl    → LabelEncoder (maps "Low/Medium/High/Critical" ↔ int)
  ordinal_encoder.pkl  → OrdinalEncoder for soil_type
  feature_names.pkl    → ordered feature list (must match inference code)
  feature_importances.json → per-feature importance scores for API

Run: python scripts/train_model.py
"""

import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder, OrdinalEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, confusion_matrix,
    accuracy_score, f1_score
)

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DATA_PATH = ROOT / "data" / "landslide_training_data.csv"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

sys.path.insert(0, str(ROOT / "scripts"))

# ─── Feature schema (must stay in sync with app/ml/model.py) ─────────────────
SOIL_TYPE_ORDER = ["rocky", "sandy_loam", "loam", "laterite", "silt", "clay"]
NUMERIC_FEATURES = [
    "slope_angle", "elevation", "vegetation_index",
    "distance_to_mining_area", "distance_to_construction_area",
    "historical_landslide_zone", "rainfall_intensity_mm",
    "rainfall_last_3_days", "rainfall_last_7_days", "rainfall_last_15_days",
    "humidity", "temperature", "soil_moisture",
    "seismic_activity", "vibration_level",
]
RISK_ORDER = ["Low", "Medium", "High", "Critical"]


# ═════════════════════════════════════════════════════════════════════════════
# DATA LOADING
# ═════════════════════════════════════════════════════════════════════════════

def load_data() -> pd.DataFrame:
    """
    Load training data.
    Priority 1: data/landslide_training_data.csv  (from fetch_real_data.py)
    Priority 2: Calibrated synthetic fallback (always produces all 4 classes)
    """
    if DATA_PATH.exists():
        df = pd.read_csv(DATA_PATH)
        print(f"Loaded {len(df)} records from {DATA_PATH.name}")
        return df

    print("No training CSV found.")
    print("  RECOMMENDED: Run 'python scripts/fetch_real_data.py' first (uses NASA/USGS/Open-Meteo).")
    print("  Falling back to calibrated synthetic data for now...\n")

    from generate_data import generate_dataset
    DATA_PATH.parent.mkdir(exist_ok=True)
    df = generate_dataset(25000)
    df.to_csv(DATA_PATH, index=False)
    print(f"Synthetic data saved to {DATA_PATH.name}")
    return df


# ═════════════════════════════════════════════════════════════════════════════
# PREPROCESSING
# ═════════════════════════════════════════════════════════════════════════════

def preprocess(df: pd.DataFrame):
    """
    1. Drop any rows missing the target label.
    2. Validate all 4 risk classes are present; warn if any are missing.
    3. Ordinal-encode soil_type.
    4. Integer-encode risk_level using a fixed class order.
    5. StandardScale all numeric features.
    """
    df = df.dropna(subset=["risk_level"]).copy()
    df = df[df["risk_level"].isin(RISK_ORDER)]

    # ── Warn about missing classes (can happen with small datasets) ──────────
    present_classes = set(df["risk_level"].unique())
    missing = set(RISK_ORDER) - present_classes
    if missing:
        print(f"WARNING: Classes {sorted(missing)} are absent from the dataset.")
        print("  Run 'python scripts/fetch_real_data.py' to get a balanced dataset.")
        print("  Training will proceed with the available classes.\n")

    # ── Ordinal encode soil_type ──────────────────────────────────────────────
    # Categories not in SOIL_TYPE_ORDER will get encoded as -1 (handled by RF)
    oe = OrdinalEncoder(
        categories=[SOIL_TYPE_ORDER],
        handle_unknown="use_encoded_value",
        unknown_value=-1,
    )
    df["soil_type_enc"] = oe.fit_transform(df[["soil_type"]])

    # ── Encode risk_level as integer (fixed mapping regardless of dataset) ────
    risk_map = {r: i for i, r in enumerate(RISK_ORDER)}
    df["risk_encoded"] = df["risk_level"].map(risk_map)

    # ── Assemble feature matrix ───────────────────────────────────────────────
    feature_cols = NUMERIC_FEATURES + ["soil_type_enc"]
    missing_cols = [c for c in feature_cols if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing feature columns in dataset: {missing_cols}")

    X = df[feature_cols].fillna(0).values.astype(np.float64)
    y = df["risk_encoded"].values.astype(int)

    # ── Scale ─────────────────────────────────────────────────────────────────
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # ── Build label encoder with fixed class list ─────────────────────────────
    le = LabelEncoder()
    le.classes_ = np.array(RISK_ORDER)

    return X_scaled, y, scaler, le, oe, feature_cols


# ═════════════════════════════════════════════════════════════════════════════
# TRAINING
# ═════════════════════════════════════════════════════════════════════════════

def train(X: np.ndarray, y: np.ndarray, y_all_labels: list):
    """
    Train RandomForestClassifier and print full evaluation metrics.
    Handles datasets where some risk classes are absent from train/test split.
    """
    # Stratify only if all classes have >= 2 samples (scikit-learn requirement)
    unique, counts = np.unique(y, return_counts=True)
    can_stratify = all(c >= 2 for c in counts)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        random_state=42,
        stratify=y if can_stratify else None,
    )

    print("Training RandomForestClassifier (200 trees, all CPU cores)...")
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",   # compensates for class imbalance
        n_jobs=-1,
        random_state=42,
    )
    clf.fit(X_train, y_train)

    # ── Evaluation ────────────────────────────────────────────────────────────
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1  = f1_score(y_test, y_pred, average="weighted")

    print("\n" + "=" * 58)
    print(f"  Test Accuracy  : {acc * 100:.2f}%")
    print(f"  Weighted F1    : {f1  * 100:.2f}%")
    print("=" * 58)

    # ── Classification report — only for classes present in test set ──────────
    present_in_test = sorted(set(y_test) | set(y_pred))
    present_names   = [RISK_ORDER[i] for i in present_in_test if i < len(RISK_ORDER)]

    print("\nClassification Report (classes present in test set):")
    print(classification_report(
        y_test, y_pred,
        labels=present_in_test,
        target_names=present_names,
        zero_division=0,
    ))

    # ── Confusion matrix — rows/cols labelled with present classes ────────────
    print("Confusion Matrix:")
    cm = confusion_matrix(y_test, y_pred, labels=present_in_test)
    cm_df = pd.DataFrame(cm, index=present_names, columns=present_names)
    print(cm_df)

    if len(present_in_test) < len(RISK_ORDER):
        absent = [RISK_ORDER[i] for i in range(len(RISK_ORDER)) if i not in present_in_test]
        print(f"\nNOTE: Class(es) {absent} had no test samples.")
        print("  Run 'python scripts/fetch_real_data.py' for a balanced real dataset.")

    return clf


# ═════════════════════════════════════════════════════════════════════════════
# SAVE ARTIFACTS
# ═════════════════════════════════════════════════════════════════════════════

def save_artifacts(clf, scaler, le, oe, feature_cols):
    """Persist model and all transformers as .pkl for fast inference."""
    joblib.dump(clf,          MODELS_DIR / "model.pkl")
    joblib.dump(scaler,       MODELS_DIR / "scaler.pkl")
    joblib.dump(le,           MODELS_DIR / "label_encoder.pkl")
    joblib.dump(oe,           MODELS_DIR / "ordinal_encoder.pkl")
    joblib.dump(feature_cols, MODELS_DIR / "feature_names.pkl")

    # Feature importances as JSON (served by /predict API for explainability)
    importances = dict(zip(feature_cols, clf.feature_importances_.tolist()))
    importances_sorted = dict(
        sorted(importances.items(), key=lambda x: x[1], reverse=True)
    )
    with open(MODELS_DIR / "feature_importances.json", "w") as f:
        json.dump(importances_sorted, f, indent=2)

    print(f"\nModel artifacts saved to {MODELS_DIR}/")
    print("\nTop Feature Importances:")
    for feat, imp in list(importances_sorted.items())[:8]:
        bar = "#" * int(imp * 40)
        print(f"  {feat:<38} {bar} {imp:.4f}")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 58)
    print("  Landslide Early Warning System — ML Training Pipeline")
    print("=" * 58 + "\n")

    df = load_data()

    print("\nDataset class distribution:")
    print(df["risk_level"].value_counts().sort_index().to_string())

    X, y, scaler, le, oe, feature_cols = preprocess(df)
    print(f"\nFeature matrix: {X.shape[0]} samples x {X.shape[1]} features")

    clf = train(X, y, y_all_labels=list(range(len(RISK_ORDER))))
    save_artifacts(clf, scaler, le, oe, feature_cols)

    print("\nTraining complete.")
    print("Start the backend with: uvicorn app.main:app --reload --port 8000")
