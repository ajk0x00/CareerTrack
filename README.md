# Production-Grade Barebone FastAPI Service (SQLAlchemy + PostgreSQL + Alembic)

A clean, production-grade FastAPI boilerplate configured with asynchronous SQLAlchemy 2.0, PostgreSQL (`asyncpg`), and Alembic database migrations. No bloat packages, dummy endpoints, or extraneous dependencies.

## Project Structure

```text
careerTrack/
├── alembic/                 # Database migration package
│   ├── env.py               # Async migration runner (wired to app settings & Base metadata)
│   ├── script.py.mako       # Migration template
│   └── versions/            # Migration revisions directory
├── app/
│   ├── __init__.py
│   ├── main.py              # Application factory, lifespan, CORS, and /healthz probe
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── router.py    # Root API v1 router (mount feature routers here)
│   └── core/
│       ├── __init__.py
│       ├── config.py        # Typed settings (App, Server, Postgres, Pool)
│       ├── database.py      # Async SQLAlchemy engine, sessionmaker, get_db, Base model
│       └── logging.py       # Production logging configuration
├── frontend/                # Barebone React + TypeScript + Vite frontend
│   ├── src/                 # Application source (App.tsx, main.tsx, index.css)
│   ├── package.json
│   └── vite.config.ts       # Configured with proxy to FastAPI backend
├── alembic.ini              # Alembic root configuration
├── .dockerignore
├── .env.example
├── .gitignore
├── compose.yaml             # Docker Compose (API default, opt-in DB)
├── Dockerfile               # Secure non-root container configuration
├── pyproject.toml
├── requirements.txt         # FastAPI, Uvicorn, Pydantic-Settings, SQLAlchemy, Asyncpg, Alembic
├── run.sh                   # Local development server runner script
└── README.md
```

## Features

- **Asynchronous SQLAlchemy 2.0**: Native `AsyncEngine`, `async_sessionmaker`, and `AsyncSession` powered by `asyncpg`.
- **Alembic Migrations**: Fully configured for asynchronous migrations using `Base.metadata` and dynamic connection settings from `app.core.config`.
- **Production Connection Pooling**: Configured with `pool_pre_ping=True`, customizable pool sizes, max overflow, and timeout.
- **Graceful Lifecycle Management**: Lifespan context manager gracefully disposes of the connection pool on shutdown.
- **External Database by Default**: Designed to run against externally managed PostgreSQL (AWS RDS, GCP Cloud SQL, Supabase, Neon, etc.).
- **Opt-In Local Database**: Optional containerized PostgreSQL via Compose profile (`--profile db`) for local offline work.
- **Zero Bloat & Zero Dummy Endpoints**: No sample tables or mock routes—ready for your domain entities.
- **Security-First Docker**: Non-root container (`appuser:appgroup`), slim Debian runtime, and layer caching.

---

## Getting Started

### 1. Local Development (Virtualenv)

Launch the local server with live-reloading using the runner script:

```bash
./run.sh
```

The script automatically initializes `.venv` and `.env` if missing, and forwards any custom CLI arguments (e.g. `./run.sh --port 8080`).

Alternatively, manually activate and run:

```bash
# Activate virtual environment
source .venv/bin/activate

# Start the development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Running in Docker with External PostgreSQL (Default / Production)

By default, Docker Compose runs **only the FastAPI service** and connects to your externally managed database:

1. Configure your external database in `.env` (or pass via container environment):
   ```env
   POSTGRES_SERVER="your-db-host.rds.amazonaws.com"
   POSTGRES_PORT=5432
   POSTGRES_USER="dbuser"
   POSTGRES_PASSWORD="securepassword"
   POSTGRES_DB="dbname"

   # Or provide a complete URI directly:
   # DATABASE_URL="postgresql+asyncpg://dbuser:securepassword@your-db-host.rds.amazonaws.com:5432/dbname"
   ```

2. Run the application:
   ```bash
   docker compose up --build -d
   ```

### 3. Opt-in: Running with Local Containerized PostgreSQL

If you do not have an external PostgreSQL instance and want to run a local containerized PostgreSQL instance, opt in using the `db` profile:

```bash
# Start both the database and API:
POSTGRES_SERVER=db docker compose --profile db up --build -d
```

---

## Database Migrations (Alembic)

Alembic is configured to use the application's declarative `Base.metadata` and dynamic database connection settings in [alembic/env.py](file:///Users/ajk/personal/careerTrack/alembic/env.py).

### Generate a Migration (Autodetect schema changes)
```bash
# Local
alembic revision --autogenerate -m "create users table"

# Inside Docker container
docker compose exec api alembic revision --autogenerate -m "create users table"
```

### Apply Migrations
```bash
# Local
alembic upgrade head

# Inside Docker container
docker compose exec api alembic upgrade head
```

### Roll Back Last Migration
```bash
# Local
alembic downgrade -1

# Inside Docker container
docker compose exec api alembic downgrade -1
```

### Check Migration Status
```bash
# View current database revision
alembic current

# View revision history
alembic history
```

---

## Database Usage Pattern

### Defining Models

Inherit from `Base` in [database.py](file:///Users/ajk/personal/careerTrack/app/core/database.py) and import your model before generating migrations:

```python
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
```

### Injecting the Database Session into Routes

Use `Depends(get_db)` to receive an `AsyncSession`. The dependency commits on success, rolls back on error, and automatically closes the session:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()

@router.get("/")
async def list_items(db: AsyncSession = Depends(get_db)):
    # Perform async queries:
    # result = await db.execute(select(User))
    # users = result.scalars().all()
    return {"message": "Success"}
```

---

## Health Check Probe

The service includes an operational liveness/readiness probe:

```bash
curl http://localhost:8000/healthz
# Output: {"status":"healthy"}
```
