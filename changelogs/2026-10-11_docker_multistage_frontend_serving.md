# Docker Multistage Frontend Build & FastAPI Static SPA Serving

**Date**: 2026-10-11

## 1. Changes Made
- `Dockerfile`: Converted the single-stage build into a multistage Dockerfile:
  - **Stage 1 (`frontend-builder`)**: Uses `node:22-alpine` to install dependencies (`npm ci`) and compile the React/TypeScript bundle (`npm run build`).
  - **Stage 2 (`runtime`)**: Uses `python:3.12-slim`, copying the compiled `frontend/dist` assets to `/app/frontend/dist` with non-root ownership (`appuser:appgroup`), alongside `scripts/` and `data/`.
- `.dockerignore`: Added `frontend/node_modules/` and `frontend/dist/` to prevent host development files from leaking into the container build context.
- `app/main.py`: Added static file and single-page application (SPA) routing in `create_app()`:
  - Mounts `/assets` via `StaticFiles` pointing to `frontend/dist/assets` when present.
  - Adds a catch-all route `/{full_path:path}` that serves specific static files if they exist (e.g. `favicon.svg`), returning `index.html` for client-side navigation (e.g. `/workspace`, `/login`), while ensuring `/api/` and `/mcp/` routes still return standard JSON 404s.
  - Path traversal is prevented using `pathlib.Path.is_relative_to()`.
  - Gracefully no-ops during local backend development if `frontend/dist` has not been built.

## 2. Why the Change Was Made (Rationale)
- The user asked if the frontend can be built via Docker multistage build and served directly from the FastAPI server.
- Compiling the frontend in a dedicated Node.js build stage and serving static assets directly from FastAPI eliminates the need for an external web server (such as Nginx or a separate CDN) in simpler production and preview deployments. A single container image now runs the complete application (API, MCP, and Web UI).
- Retaining fallback behavior ensures developers running the Vite dev server locally (`localhost:3000`) or `./run.sh` are unaffected.

## 3. Things to Lookout for in Future Development
- **Local Dev vs Prod**: During local development with Vite (`npm run dev`), Vite proxies to port 8000. In production Docker containers, FastAPI serves both the SPA and API on port 8000.
- **Client Routing vs API 404s**: The catch-all route intentionally rejects paths starting with `api/` or `mcp/` so that broken API requests return proper JSON error responses rather than `index.html`.
