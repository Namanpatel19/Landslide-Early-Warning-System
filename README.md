# LandWatch NER — AI Landslide Early Warning System

> **Smart India Hackathon (SIH) 2024** · Northeast India · Team Project

An AI-powered Landslide Early Warning and Risk Monitoring System for Northeast India (NER). Combines static geological data with live weather and seismic signals to predict landslide risk (Low / Medium / High / Critical) in under 1 second.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Leaflet)                                 │
│  Interactive NER Map → Click → Prediction Card              │
│  Rainfall Chart · High-Risk Zones · Alert History           │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP (axios, /api proxy)
┌────────────────────▼────────────────────────────────────────┐
│  Backend (FastAPI, async)                                   │
│  POST /predict → parallel fetch → ML inference              │
│  GET /history  · GET /alerts · POST /alerts/notify          │
└──────────┬──────────────┬──────────────────┬────────────────┘
           │              │                  │
    ┌──────▼──────┐ ┌─────▼──────┐ ┌────────▼──────┐
    │ Open-Meteo  │ │    USGS    │ │   SQLite DB   │
    │  (weather)  │ │ (seismic)  │ │ (predictions) │
    └─────────────┘ └────────────┘ └───────────────┘
           │
    ┌──────▼──────────────────────────────┐
    │  RandomForestClassifier (sklearn)   │
    │  13 features · <1ms inference       │
    │  model.pkl + scaler.pkl saved       │
    └─────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** and **Node.js 18+**
- Internet connection (for free external APIs)

### 1. Clone / Open Project
```bash
cd SIH/
```

### 2. Backend Setup
```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Train the ML model (one-time, ~30 seconds)
python scripts/train_model.py

# Start the API server
uvicorn app.main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**  
API docs (Swagger): **http://localhost:8000/docs**

### 3. Frontend Setup
```bash
cd frontend

# Install Node dependencies (already done if you ran npm install)
npm install

# Start development server
npm run dev
```

Frontend runs at: **http://localhost:5173**

### 4. Use the App
1. Open **http://localhost:5173**
2. **Click anywhere on the Northeast India map** to trigger a prediction
3. See risk level, confidence %, live weather data, and top contributing factors
4. Critical/High risk predictions automatically appear in **Alert History**
5. Confidence > 90% triggers the **Critical Alert Modal**

---

## 📡 API Documentation

### `POST /predict`
Fetches live data and returns risk prediction for a location.

**Request:**
```json
{ "lat": 25.57, "lon": 91.88, "location_name": "Shillong" }
```

**Response:**
```json
{
  "lat": 25.57,
  "lon": 91.88,
  "location_name": "Meghalaya Plateau (25.5700°N, 91.8800°E)",
  "risk_level": "High",
  "confidence": 0.823,
  "risk_score": 0.61,
  "features": {
    "rainfall_intensity_mm": 87.4,
    "soil_moisture": 0.72,
    "slope_angle": 28.4,
    ...
  },
  "top_factors": [
    {"name": "rainfall_intensity_mm", "importance": 0.2341},
    {"name": "slope_angle", "importance": 0.1823},
    ...
  ],
  "timestamp": "2024-09-09T14:30:00Z",
  "cached": false
}
```

### `GET /history?limit=50&risk_level=High`
Returns past predictions. Optional filter by `risk_level`.

### `GET /history/high-risk-zones`
Returns distinct locations with recent High/Critical predictions.

### `GET /alerts?limit=50`
Returns all alert logs (High/Critical predictions).

### `POST /alerts/notify`
Logs an authority notification for an alert.
```json
{ "prediction_id": 42, "method": "dashboard" }
```

### `GET /health`
Returns `{"status": "healthy", "model_loaded": true}`.

---

## 🤖 ML Pipeline

### Features Used

| Feature | Type | Source |
|---------|------|--------|
| `slope_angle` | Numeric | NER terrain lookup |
| `elevation` | Numeric | NER terrain lookup |
| `vegetation_index` | Numeric (NDVI) | NER zone lookup |
| `soil_type` | Ordinal encoded | NER soil survey |
| `historical_landslide_zone` | Boolean | NER zone lookup |
| `distance_to_mining_area` | Numeric | NER zone lookup |
| `distance_to_construction_area` | Numeric | NER zone lookup |
| `rainfall_intensity_mm` | Numeric | **Open-Meteo API** (live) |
| `humidity` | Numeric | **Open-Meteo API** (live) |
| `temperature` | Numeric | **Open-Meteo API** (live) |
| `soil_moisture` | Numeric | **Open-Meteo API** (live) |
| `seismic_activity` | Numeric | **USGS API** (live) |
| `vibration_level` | Numeric | Simulated (IoT future scope) |

### Risk Classes
| Class | Description |
|-------|-------------|
| 🟢 Low | Minimal risk, normal monitoring |
| 🟡 Medium | Elevated risk, increased vigilance |
| 🟠 High | High risk, alert authorities |
| 🔴 Critical | Imminent risk, evacuate if needed |

### Model Performance (Synthetic NER Data)
After running `train_model.py`, you'll see accuracy, F1-score, and confusion matrix printed to console. Typical results on 6000 synthetic samples:
- **Accuracy**: ~88-93%
- **Weighted F1**: ~87-92%

---

## 📁 Project Structure

```
SIH/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── schemas.py           # Pydantic models
│   │   ├── database.py          # SQLite + SQLAlchemy
│   │   ├── routers/
│   │   │   ├── predict.py       # POST /predict
│   │   │   ├── history.py       # GET /history
│   │   │   └── alerts.py        # GET/POST /alerts
│   │   ├── services/
│   │   │   ├── weather.py       # Open-Meteo client
│   │   │   ├── seismic.py       # USGS client
│   │   │   ├── geo.py           # NER geo lookup
│   │   │   └── cache.py         # TTL cache
│   │   └── ml/
│   │       └── model.py         # Inference module
│   ├── scripts/
│   │   ├── generate_data.py     # Synthetic data gen
│   │   └── train_model.py       # Training pipeline
│   ├── models/                  # Saved .pkl files
│   ├── data/                    # Training CSV
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main layout
│   │   ├── components/
│   │   │   ├── Map.jsx          # Leaflet map
│   │   │   ├── RiskCard.jsx     # Prediction card
│   │   │   ├── AlertModal.jsx   # Critical popup
│   │   │   ├── AlertHistory.jsx # Alert log
│   │   │   ├── RainfallChart.jsx# 7-day chart
│   │   │   └── HighRiskZones.jsx# Zones list
│   │   ├── services/api.js      # Axios client
│   │   └── utils/helpers.js     # Formatters
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
└── README.md
```

---

## 🌐 Free APIs Used

| API | Used For | Key Required |
|-----|----------|-------------|
| [Open-Meteo](https://open-meteo.com/) | Live weather, rainfall, humidity, soil moisture | ❌ Free |
| [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/) | Seismic activity data | ❌ Free |
| [OpenStreetMap](https://www.openstreetmap.org/) | Map tiles | ❌ Free |

---

## 🚢 Deployment

### Backend → Render (Free Tier)
1. Push to GitHub
2. Connect repo to [render.com](https://render.com)
3. Set: **Build command**: `pip install -r requirements.txt && python scripts/train_model.py`
4. Set: **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Frontend → Vercel / Netlify
1. Set environment variable: `VITE_API_URL=https://your-backend.onrender.com`
2. **Build command**: `npm run build`
3. **Output directory**: `dist`

### Docker Compose (local)
```bash
docker-compose up --build
```
*(docker-compose.yml can be added as needed)*

---

## 🔮 Future Scope

| Feature | Tech |
|---------|------|
| Real IoT vibration sensors | LoRa/GSM + AWS IoT / Thingsboard |
| SMS/Push authority alerts | Twilio Free Tier + Firebase Cloud Messaging |
| Real-time elevation data | OpenTopography SRTM API |
| Satellite NDVI | NASA POWER / Sentinel Hub |
| Actual soil data | SoilGrids ISRIC REST API |
| Time-series deep learning | LSTM for multi-day forecasting |
| Mobile app | React Native / Flutter |

---

## 👥 Team

Built for **Smart India Hackathon 2024** — Problem Statement: AI-based Early Warning System for Natural Disasters in Northeast India.

---

*All external APIs used are free-tier with no API keys required.*
