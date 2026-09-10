"""
TTL (Time-To-Live) In-Memory Cache
===================================
Simple dict-based cache to avoid redundant calls to free external APIs.
Default TTL: 5 minutes (300 seconds).
Thread-safe for async usage (no mutation race conditions for our use case).

Why not Redis? For a hackathon prototype on SQLite, this is sufficient
and keeps the deployment stack minimal.
"""

import time
from typing import Any, Optional


class TTLCache:
    """Lightweight in-memory cache with per-key TTL expiry."""

    def __init__(self, default_ttl: int = 300):
        self._store: dict[str, tuple[Any, float]] = {}  # key → (value, expiry_ts)
        self.default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        """Return cached value if not expired, else None."""
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expiry = entry
        if time.monotonic() > expiry:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Store value with TTL expiry."""
        ttl = ttl or self.default_ttl
        self._store[key] = (value, time.monotonic() + ttl)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()

    def __len__(self) -> int:
        # Clean up expired entries on size check
        now = time.monotonic()
        self._store = {k: v for k, v in self._store.items() if v[1] > now}
        return len(self._store)


# Global singleton cache instance
# Weather data TTL: 5 minutes (free API rate limits)
weather_cache = TTLCache(default_ttl=300)

# Geo data (elevation, soil) changes rarely — cache for 60 minutes
geo_cache = TTLCache(default_ttl=3600)
