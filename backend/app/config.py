"""
Application Configuration — loaded from .env via python-dotenv.
All API keys and settings are accessed through this module.
Never import os.getenv directly in service files — use this instead.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend directory (one level up from app/)
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path)


class Settings:
    # ── Application ──────────────────────────────────────────────
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    ALLOWED_ORIGINS: list[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173"
    ).split(",")

    # ── Database ─────────────────────────────────────────────────
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite+aiosqlite:///./landslide.db"
    )

    # ── News API (GNews) ─────────────────────────────────────────
    GNEWS_API_KEY: str = os.getenv("GNEWS_API_KEY", "")

    # ── Planet Labs (replaces deprecated Sentinel Hub) ──────────────────
    PLANET_API_KEY: str = os.getenv("PLANET_API_KEY", "")
    # Legacy Sentinel Hub keys (kept for reference, no longer functional)
    SENTINELHUB_CLIENT_ID: str = os.getenv("SENTINELHUB_CLIENT_ID", "")
    SENTINELHUB_CLIENT_SECRET: str = os.getenv("SENTINELHUB_CLIENT_SECRET", "")

    # ── NASA Earthdata ────────────────────────────────────────────
    NASA_EARTHDATA_TOKEN: str = os.getenv("NASA_EARTHDATA_TOKEN", "")

    # ── Google Gemini ────────────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # ── Twilio SMS ───────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "")
    TEST_SMS_NUMBERS: str = os.getenv("TEST_SMS_NUMBERS", "")

    # ── Convenience flags ────────────────────────────────────────
    @property
    def has_gnews(self) -> bool:
        return bool(self.GNEWS_API_KEY)

    @property
    def has_planet(self) -> bool:
        return bool(self.PLANET_API_KEY)

    @property
    def has_sentinel(self) -> bool:
        return bool(self.SENTINELHUB_CLIENT_ID and self.SENTINELHUB_CLIENT_SECRET)

    @property
    def has_nasa(self) -> bool:
        return bool(self.NASA_EARTHDATA_TOKEN)

    @property
    def has_gemini(self) -> bool:
        return bool(self.GEMINI_API_KEY)


# Singleton — import this everywhere
settings = Settings()
