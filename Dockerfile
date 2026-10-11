# ==========================================
# Stage 1: Build Frontend (Node.js)
# ==========================================
FROM node:22-alpine AS frontend-builder

WORKDIR /build

# Copy dependency manifests first to leverage Docker layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source code and compile production bundle
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Python Runtime
# ==========================================
FROM python:3.12-slim AS runtime

# Set environment variables for Python in Docker
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Create non-root user and group
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin -d /app appuser

# Install dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code, migration files, and scripts
COPY --chown=appuser:appgroup alembic.ini .
COPY --chown=appuser:appgroup ./alembic /app/alembic
COPY --chown=appuser:appgroup ./app /app/app
COPY --chown=appuser:appgroup ./scripts /app/scripts
COPY --chown=appuser:appgroup ./data /app/data

# Copy built frontend assets from builder stage
COPY --chown=appuser:appgroup --from=frontend-builder /build/dist /app/frontend/dist

# Switch to non-root user
USER appuser

# Expose server port
EXPOSE 8000

# Container health check using Python standard library (no curl/wget bloat)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz', timeout=2)" || exit 1

# Launch application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
