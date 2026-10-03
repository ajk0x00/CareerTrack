# Agent Guidelines & Repository Architecture

This document provides architectural standards, conventions, and operational workflows for AI agents and developers working in the `careerTrack` repository.

---

# Project Vision
This project aims to streamline the process of job searching and work accomplishment logging. The application aim to store details and experiences of user at work (accomplishments, accuired skills, preferences). Then use those information to tailor an ATS friendly resume according to job description.

## 1. Architecture Overview

`careerTrack` is a production-grade full-stack application consisting of:
- **Backend**: FastAPI with async SQLAlchemy 2.0, PostgreSQL via `asyncpg`, and Alembic migrations.
- **Frontend**: Barebone React (v19) with TypeScript and Vite.
- **Infrastructure**: Containerized with Docker and Docker Compose (supporting external PostgreSQL by default, and opt-in containerized PostgreSQL for local development).

---

## 2. Architectural Guidelines & Production Standards

### General Principles
- **Prodction standards**: Always follow production grade standards of that specific technology while generating code.
- **No Bloat Packages**: Avoid adding extraneous dependencies. Always prioritize standard library solutions or the existing lean stack (`fastapi`, `uvicorn[standard]`, `pydantic-settings`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`).
- **Strict Typing**: All backend code must have full type annotations (`collections.abc`, `typing`, Pydantic models). All frontend code must use TypeScript with strict compiler checks.

### Backend Standards (`app/`)
- **Application Factory**: App instance is constructed via `create_app()` in [app/main.py](file:///Users/ajk/personal/careerTrack/app/main.py).
- **Lifespan Management**: Use `asynccontextmanager` (`lifespan`) for startup/shutdown tasks (logging setup, closing connection pools). Do NOT use deprecated `@app.on_event("startup")`.
- **Configuration**: Managed via `Settings` extending `pydantic_settings.BaseSettings` in [app/core/config.py](file:///Users/ajk/personal/careerTrack/app/core/config.py), reading from `.env`. Use `@lru_cache` on `get_settings()`.
- **Database & Session Management**:
  - Asynchronous engine and sessionmaker are defined in [app/core/database.py](file:///Users/ajk/personal/careerTrack/app/core/database.py).
  - Inject database sessions into routes using `Depends(get_db)`.
  - `get_db` automatically commits on successful exit, rolls back on error, and ensures the session is closed.
  - On application shutdown, `close_db_connection()` is invoked in the lifespan to dispose of the pool.
- **API Routing**:
  - Mount feature routers inside [app/api/v1/router.py](file:///Users/ajk/personal/careerTrack/app/api/v1/router.py).
  - Prefix all v1 routes under `settings.API_V1_PREFIX` (`/api/v1`).
- **Operational Health Check**:
  - Keep `/healthz` lightweight and unauthenticated for container orchestrator probes (Docker / Kubernetes).

### Database & Migrations (`alembic/`)
- Models must inherit from `Base` in [app/core/database.py](file:///Users/ajk/personal/careerTrack/app/core/database.py).
- Alembic is configured in [alembic/env.py](file:///Users/ajk/personal/careerTrack/alembic/env.py) to read the database URI dynamically from application settings and bind to `Base.metadata`.
- Always generate migrations using `--autogenerate` after changing models, and review the resulting revision file in `alembic/versions/`.

### Frontend Standards (`frontend/`)
- Built with Vite, React, and TypeScript.
- **API Proxy**: In development, requests to `/api` and `/healthz` are proxied to `http://localhost:8000` via [frontend/vite.config.ts](file:///Users/ajk/personal/careerTrack/frontend/vite.config.ts).
- **Styling**: Vanilla CSS using root design tokens in [frontend/src/index.css](file:///Users/ajk/personal/careerTrack/frontend/src/index.css). Do not install CSS utility frameworks unless requested.

### Container & Infrastructure
- **Security**: [Dockerfile](file:///Users/ajk/personal/careerTrack/Dockerfile) uses `python:3.12-slim` with non-root user `appuser` (UID 10001).
- **Docker Compose**:
  - Default mode: Runs only the `api` service connecting to an external PostgreSQL database.
  - Opt-in database: Local PostgreSQL is encapsulated in the `db` profile (`docker compose --profile db up -d`).

---

## 3. Directory Layout

```text
careerTrack/
├── alembic/                 # Alembic async migration environment
│   ├── env.py               # Migration context wired to Base.metadata & settings
│   ├── script.py.mako       # Migration template
│   └── versions/            # Versioned migration scripts
├── app/                     # Backend Python source
│   ├── api/
│   │   └── v1/
│   │       └── router.py    # Main API router mount point
│   ├── core/
│   │   ├── config.py        # Pydantic BaseSettings
│   │   ├── database.py      # Async SQLAlchemy engine, sessionmaker, Base, get_db
│   │   └── logging.py       # Production standard library logging
│   └── main.py              # Application entrypoint & lifespan
├── frontend/                # Frontend React + TypeScript + Vite app
│   ├── src/
│   │   ├── App.tsx          # Root component
│   │   ├── index.css        # Clean CSS reset & design tokens
│   │   └── main.tsx         # React root mount
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts       # Vite configuration with API proxy
├── .dockerignore
├── .env.example             # Environment variable template
├── .gitignore
├── alembic.ini              # Alembic config
├── compose.yaml             # Docker Compose orchestration
├── Dockerfile               # Production multi-stage Docker build
├── pyproject.toml           # Python package metadata
├── requirements.txt         # Lean backend dependencies
├── run.sh                   # Backend local runner script
├── README.md                # General project documentation
└── AGENT.md                 # Agent and architecture guidelines
```

---

## 4. Common Developer & Agent Workflows

### Running Backend Locally
```bash
# Using the local runner script (auto-creates .venv and .env if missing)
./run.sh

# Or with custom options
./run.sh --port 8080
```

### Running Frontend Locally
```bash
cd frontend
npm run dev      # Starts on http://localhost:3000
npm run build    # Type-checks and creates production bundle
```

### Database Migrations
```bash
# Generate migration after modifying models
alembic revision --autogenerate -m "add description"

# Apply pending migrations
alembic upgrade head

# Rollback last migration
alembic downgrade -1

# Inside Docker
docker compose exec api alembic upgrade head
```

### Docker Commands
```bash
# Production / External DB mode (default)
docker compose up --build -d

# Local development with opt-in DB container
POSTGRES_SERVER=db docker compose --profile db up --build -d

# View logs
docker compose logs -f
```

---

## 5. Rules for Modifying This Codebase

1. **Verify Before Committing**: Run type checking (`tsc -b` in frontend, python import/syntax checks in backend) before finalizing edits.
2. **Environment Variable Parity**: Any new config added to `Settings` in [app/core/config.py](file:///Users/ajk/personal/careerTrack/app/core/config.py) MUST also be documented in [.env.example](file:///Users/ajk/personal/careerTrack/.env.example).
3. **No Unneeded Dependencies**: Always check whether a feature can be cleanly implemented using existing packages or the Python / Web standard libraries before installing new npm or pip packages.
