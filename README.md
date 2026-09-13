# LandWatch NER: AI-Powered Landslide Early Warning System

A highly accurate, real-time AI landslide prediction system designed for Northeast India (NER). Built for the Smart India Hackathon (SIH).

## Key Features

### 1. Accurate Live Ensemble ML Prediction
Combines multiple models for maximum reliability:
- **Tabular Model (75% Weight):** A trained RandomForest/XGBoost model evaluating 13 real-time environmental factors (rainfall, soil moisture, slope, seismic activity, etc.)
- **Classical CV / CNN (15% Weight):** Analyzes satellite imagery for vegetation loss (NDVI proxy), bare soil ratio, and surface texture roughness.
- **Gemini Vision AI (10% Weight):** Uses Google Gemini 2.0 Flash to detect visible cracks, severe erosion, and debris accumulation in satellite or uploaded drone imagery. 

### 2. Auto-Scanned Critical Locations (Background Sweeper)
- Monitors **20 predefined high-risk zones** across all 8 Northeast states.
- **Sync Frequency:** The backend automatically sweeps all 20 locations every **2 minutes**. This stagger logic (`SWEEP_INTERVAL_SECONDS = 120`, delay of 1.5s between API calls) safely respects the rate limits of all free-tier APIs (Open-Meteo, USGS, OSM) while providing near real-time updates.
- Results are displayed in a sortable UI grid, prioritizing "Critical" risk zones.

### 3. Dual-Portal Interface
- **Citizen Portal (`/report`):** A clean interface for tourists and locals to upload photos of suspicious land movement. EXIF GPS data is automatically extracted, with a manual fallback if missing. No sensitive authority data is exposed here.
- **Authority Portal (`/admin`):** A secure dashboard for disaster management officials. Displays all crowdsourced reports (sorted by Gemini AI's initial severity assessment) and allows officials to mark them as "Verified Threat" or "False Report". Also tracks all system-generated High/Critical alerts.

### 4. Explainable AI for Authorities
To make the AI actionable, every prediction generates a **plain-language explanation** via the Gemini API (e.g., "This area shows Critical risk due to 54mm/day rainfall combined with a steep 32° slope and recent vegetation loss"). This helps non-technical officials quickly justify evacuation orders.

## Architecture & API Usage

All external APIs used are 100% free or have generous free tiers.

- **Google Gemini API:** Provides visual risk analysis (Vision) and plain-language explanations. Key required in `.env` (`GEMINI_API_KEY`).
- **Open-Meteo:** Real-time rainfall, soil moisture, and temperature. (No key required).
- **USGS Earthquake API:** Live seismic data. (No key required).
- **OpenStreetMap / Nominatim:** Geocoding and map tiles. (No key required).
- **GNews / Google News RSS:** Fetches relevant local news. (Works via free RSS fallback).

## Setup & Running

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
pip install google-generativeai  # Required for Gemini integration

# Create .env file and add:
# GEMINI_API_KEY=your_key_here

# Start the server (runs on port 8000)
python -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

### 2. Frontend (React/Vite)
```bash
cd frontend
npm install

# Start the dev server (runs on port 5173)
npm run dev
```

The app will be available at `http://localhost:5173/`.
