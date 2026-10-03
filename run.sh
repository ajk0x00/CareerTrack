#!/usr/bin/env bash
set -euo pipefail

# Resolve project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

VENV_DIR="$PROJECT_ROOT/.venv"

# 1. Verify / initialize virtual environment
if [ ! -d "$VENV_DIR" ]; then
    echo "==> Virtual environment not found at $VENV_DIR."
    echo "==> Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "==> Installing dependencies from requirements.txt..."
    "$VENV_DIR/bin/pip" install --upgrade pip
    "$VENV_DIR/bin/pip" install -r requirements.txt
fi

# 2. Ensure .env exists
if [ ! -f "$PROJECT_ROOT/.env" ] && [ -f "$PROJECT_ROOT/.env.example" ]; then
    echo "==> .env not found. Initializing from .env.example..."
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
fi

# 3. Read host/port with fallback defaults
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

echo "============================================================"
echo " Starting FastAPI Development Server"
echo " URL:         http://${HOST}:${PORT}"
echo " Docs:        http://${HOST}:${PORT}/docs"
echo " Healthcheck: http://${HOST}:${PORT}/healthz"
echo " Hot Reload:  Enabled"
echo "============================================================"

# 4. Run uvicorn server passing any additional CLI flags
exec "$VENV_DIR/bin/uvicorn" app.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --reload \
    "$@"
