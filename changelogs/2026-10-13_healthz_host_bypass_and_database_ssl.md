# Health Check Trusted Host Bypass and Database SSL Normalization Safeguard

**Date**: 2026-10-13

## 1. Changes Made
- `app/main.py`:
  - Implemented `HealthCheckBypassTrustedHostMiddleware` (extending `TrustedHostMiddleware`) to bypass host header validation for operational `/healthz` probes.
  - Automatically added `localhost` and `127.0.0.1` to `allowed_hosts` when `ALLOWED_HOSTS` is restricted.
- `app/core/database.py`:
  - Added direct call to `normalize_database_url()` when initializing SQLAlchemy's `create_async_engine()` as an extra safeguard for managed cloud database URLs.

## 2. Why the Change Was Made (Rationale)
- When deployed with `ALLOWED_HOSTS` configured (e.g. `["*.dataops.in"]`), Docker container health check probes requesting `http://localhost:8000/healthz` were rejected with `400 Bad Request` (`Invalid host header`), marking containers unhealthy in production.
- Rule 2 of the repo guidelines mandates keeping `/healthz` dependency-free and unauthenticated. Bypassing host validation on `/healthz` ensures internal health checks and cloud load balancer probes always succeed regardless of the host header used.
- In production, cloud-managed PostgreSQL connection strings (e.g., Neon) supply `sslmode=require&channel_binding=require`. SQLAlchemy's asyncpg dialect raises `TypeError: connect() got an unexpected keyword argument 'sslmode'` if these parameters are not normalized. Wrapping engine initialization directly with `normalize_database_url` ensures database connection strings are always asyncpg-safe.

## 3. Things to Lookout for in Future Development
- **Production Container Rebuild**: Production Docker containers must be rebuilt (`docker compose build api && docker compose up -d api`) after pulling changes to ensure the updated Python code and middleware run in production.
- **Settings Cache**: `get_settings()` is cached via `lru_cache`; any change to environment variables in `.env` requires a container or process restart.
