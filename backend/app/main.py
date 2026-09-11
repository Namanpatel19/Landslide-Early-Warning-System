"""
FastAPI Application Entry Point — Landslide Early Warning System (SIH)
=======================================================================
Startup: loads .env → initializes DB → loads ML model
Routes: /predict, /history, /alerts, /news, /satellite, /health
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load .env FIRST before any other app imports
from .config import settings

from .database import init_db
from .ml.model import load_model, is_model_loaded
from .routers import predict, history, alerts, news, satellite

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Lifespan (startup / shutdown) ───────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Landslide Early Warning System API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"GNews API: {'configured' if settings.has_gnews else 'not set (using RSS fallback)'}")
    logger.info(f"Sentinel Hub: {'configured' if settings.has_sentinel else 'not set (using ESRI tiles)'}")

    await init_db()
    logger.info("Database initialized")

    load_model()
    if is_model_loaded():
        logger.info("ML Model loaded successfully")
    else:
        logger.error("ML Model NOT loaded — run: python scripts/train_model.py")

    yield  # ← app is running

    logger.info("Shutting down API...")


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="LandWatch NER — Landslide Early Warning API",
    description=(
        "AI-powered landslide risk prediction for Northeast India. "
        "Combines real-time weather (Open-Meteo), seismic (USGS), "
        "satellite imagery (Sentinel Hub/ESRI), and ML (RandomForest) "
        "to predict Low/Medium/High/Critical risk in under 1 second."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# In development: allow all origins (any Vite port works without config changes)
# In production:  restrict to ALLOWED_ORIGINS from .env
_cors_origins = ["*"] if settings.ENVIRONMENT == "development" else settings.ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,   # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(predict.router)
app.include_router(history.router)
app.include_router(alerts.router)
app.include_router(news.router)
app.include_router(satellite.router)


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {
        "status":          "healthy",
        "model_loaded":    is_model_loaded(),
        "environment":     settings.ENVIRONMENT,
        "gnews":           settings.has_gnews,
        "sentinel_hub":    settings.has_sentinel,
        "apis": {
            "weather":  "Open-Meteo (free, no key)",
            "seismic":  "USGS Earthquake (free, no key)",
            "geocoding":"OpenStreetMap Nominatim (free, no key)",
            "satellite": "Sentinel Hub (key) / ESRI World Imagery (free)",
            "news":     "GNews (key) / Google News RSS (free)",
        }
    }
