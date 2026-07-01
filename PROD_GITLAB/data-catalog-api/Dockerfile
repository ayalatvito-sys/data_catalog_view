# ============================================================
# API — Production Dockerfile for GCP Cloud Run
# Repo: data-catalog-api
# ============================================================

# ---- Build stage: install dependencies ----
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build deps (needed for some wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ---- Runtime stage: lean final image ----
FROM python:3.12-slim AS runtime

# Cloud Run best practice: run as non-root
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY --chown=appuser:appgroup . .

USER appuser

# Cloud Run injects PORT env var; default to 8080
ENV PORT=8080

# GCP project/location — override at Cloud Run service level
ENV GCP_PROJECT_ID=""
ENV GCP_LOCATION="me-west1"

EXPOSE 8080

# Use 2 workers; Cloud Run scales horizontally so 1-2 workers per container is ideal.
# Adjust --workers based on your Cloud Run CPU allocation (1 vCPU → 1-2 workers).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2"]
