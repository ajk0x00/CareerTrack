# AsyncPG SSLMode Connection String Normalization

**Date**: 2026-10-11

## 1. Changes Made
- `app/core/config.py`: Added `normalize_database_url()` helper to `Settings.SQLALCHEMY_DATABASE_URI`:
  - Automatically translates libpq `sslmode` query parameter (e.g. `?sslmode=require`) to asyncpg's expected `ssl=require` parameter.
  - Strips unsupported libpq query parameters such as `channel_binding` and `gssencmode` that cause `TypeError` in `asyncpg.connect()`.
  - Normalizes `postgresql://` and `postgres://` prefixes to `postgresql+asyncpg://`.
- `scripts/import-data.py`: Updated `normalize_db_url()` to apply the same normalization rules so manual migration scripts can connect to managed cloud databases (Neon, Supabase, Render, AWS RDS) without SSL configuration errors.

## 2. Why the Change Was Made (Rationale)
- When running `docker compose run --rm api alembic upgrade head` with a managed PostgreSQL connection string (such as Neon), SQLAlchemy's asyncpg dialect forwards URL query parameters directly as keyword arguments to `asyncpg.connect()`.
- Standard PostgreSQL / libpq connection strings include `?sslmode=require` and often `&channel_binding=prefer`. Because `asyncpg` does not take `sslmode` as a parameter (expecting `ssl="require"` instead), this triggered `TypeError: connect() got an unexpected keyword argument 'sslmode'`.
- Normalizing the parameters at the config level ensures Alembic, the FastAPI runtime engine, and data import scripts seamlessly support managed cloud database URLs out of the box without requiring manual URL editing.

## 3. Things to Lookout for in Future Development
- **URL Caching**: Settings are cached via `lru_cache`, so changing `DATABASE_URL` in the environment requires restarting the service.
- **Docker Image Layering**: Rebuilding the Docker image (`docker compose build api`) is required whenever `app/core/config.py` changes before running one-off containers like `docker compose run --rm api alembic upgrade head`.
