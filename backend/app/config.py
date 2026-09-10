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

    # ── Sentinel Hub ─────────────────────────────────────────────
    SENTINELHUB_CLIENT_ID: str = os.getenv("SENTINELHUB_CLIENT_ID", "")
    SENTINELHUB_CLIENT_SECRET: str = os.getenv("SENTINELHUB_CLIENT_SECRET", "")

    # ── NASA Earthdata ────────────────────────────────────────────
    NASA_EARTHDATA_TOKEN: str = os.getenv("NASA_EARTHDATA_TOKEN", "")

    # ── Convenience flags ────────────────────────────────────────
    @property
    def has_gnews(self) -> bool:
        return bool(self.GNEWS_API_KEY)

    @property
    def has_sentinel(self) -> bool:
        return bool(self.SENTINELHUB_CLIENT_ID and self.SENTINELHUB_CLIENT_SECRET)

    @property
    def has_nasa(self) -> bool:
        return bool(self.NASA_EARTHDATA_TOKEN)


# Singleton — import this everywhere
settings = Settings()
