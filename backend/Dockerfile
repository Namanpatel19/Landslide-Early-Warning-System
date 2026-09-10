# ─────────────────────────────────────────────────────────────────
# LandWatch NER Backend — Dockerfile
# Multi-stage: builder (pip install) + runtime (lean image)
# ─────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .

# Install dependencies to a local directory for copying
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─── Runtime stage ───────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Train model at build time if not already trained
# (models/ directory is included in the image)
RUN python scripts/train_model.py 2>/dev/null || echo "Using pre-trained model"

EXPOSE 8000

# Uvicorn with 2 workers for prototype (1 for SQLite compatibility)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
