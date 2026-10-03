# AGENTS.md — careerTrack

Rules for AI agents working in this repo. Follow them in order. Where these rules conflict with general habits, these rules win.

## Project Vision

careerTrack makes job searching and logging accomplishments at work easier. It stores what the user does at work (accomplishments, skills they've picked up, preferences) and uses that history to write an ATS-friendly resume tailored to a specific job description.

---

## 0. Mandatory Workflow (every task)

1. **Read changelogs first.** Before planning or editing, list `changelogs/` and read every entry related to the area you are touching. Pay most attention to each entry's **"Things to Lookout for"** section.
2. **Read before writing.** Open the files you plan to change. Do not assume their contents from this document.
3. **Make the smallest change that works.** Don't add placeholder or sample code, unused abstractions, or speculative features.
4. **Verify** using the commands in §4. Do not report a task as done if verification fails.
5. **Write a changelog entry** (§5) if the change touches models, migrations, routes, frontend views/state, config, dependencies, or infrastructure.

---

## 1. Stack

| Layer | Tech | Entry point |
|---|---|---|
| API | FastAPI, Uvicorn | `app/main.py` (`create_app()`, `lifespan`) |
| Config | pydantic-settings, reads `.env` | `app/core/config.py` (`get_settings()`, cached) |
| DB | SQLAlchemy 2.x async + `asyncpg`, PostgreSQL | `app/core/database.py` (`Base`, `get_db`, `engine`) |
| Migrations | Alembic (async template) | `alembic/env.py` |
| Frontend | React 19, TypeScript, Vite | `frontend/src/main.tsx`, `frontend/src/App.tsx` |
| Infra | Docker (`python:3.12-slim`, non-root UID 10001), Compose | `Dockerfile`, `compose.yaml` |

Approved dependencies: `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pyjwt`, `bcrypt`, `react`, `react-dom`, `react-router-dom`. **Ask the user before adding any other runtime dependency.**

---

## 2. Rules

### General
- Write code to the production standard of the technology you're using: full error handling, no hardcoded secrets, no debug leftovers.
- Use strict typing everywhere. Python: annotate every function and use `Mapped[...]` for model columns. TypeScript: don't use `any` or `// @ts-ignore`.
- Prefer the standard library over new packages.
- use [BE] tag in backend related commits, use [FE] tag in frontend related commits.

### Backend (`app/`)
- Use `lifespan` for startup and shutdown. Never use `@app.on_event`.
- Put feature routers in `app/api/v1/endpoints/<feature>.py` and mount them in `app/api/v1/router.py`. All of them are served under `/api/v1`.
- Inject sessions with `db: AsyncSession = Depends(get_db)`.
- **Don't call `await db.commit()` in routes.** `get_db` commits on success and rolls back on exception. If you need generated IDs before returning, use `await db.flush()`.
- Every new `Settings` field also goes in `.env.example`.
- Keep `/healthz` dependency-free and unauthenticated.

### Models & Migrations
- Models go in `app/models/<entity>.py` and inherit from `Base` in `app/core/database.py`.
- Re-export each model from `app/models/__init__.py`, and make sure `alembic/env.py` runs `import app.models`. Otherwise autogenerate won't see the model.
- **Never import models into `app/core/database.py`.** It causes a circular import.
- Generate with `alembic revision --autogenerate -m "<msg>"`, then **read and fix the generated file** before you apply it. Autogenerate misses renames, server defaults, and enum changes.
- Never edit a migration that has already been applied or committed. Write a new one.

### Frontend (`frontend/`)
- Call the backend with relative URLs (`/api/v1/...`). The Vite dev server proxies `/api` and `/healthz` to `localhost:8000`.
- Style with plain CSS using the tokens in `src/index.css`. Don't add CSS frameworks or UI kits unless the user asks.
- Break the UI Down into reusable components whenever is possible

### Infra
- `docker compose up` starts **only the API** and connects to an external Postgres (that's the production model).
- The local Postgres is opt-in: `POSTGRES_SERVER=db docker compose --profile db up`.
- If you add a top-level directory the container needs at runtime, add a `COPY` line for it in `Dockerfile`.

---

## 3. Known Gotchas

- **Python version drift:** the local `.venv` runs Python 3.14 and Docker runs 3.12. Don't use syntax or stdlib APIs newer than 3.12.
- **Settings are cached:** `get_settings()` is `lru_cache`d, and `database.py` builds the engine when it's imported. Changes to env vars need a process restart.
- **DB URL normalization:** a `DATABASE_URL` that starts with `postgresql://` is rewritten to `postgresql+asyncpg://`. Don't use a sync driver URL anywhere.
- **No DB in CI or local by default:** `alembic upgrade`, `alembic check`, and DB-backed requests need a reachable Postgres. Import checks don't.
- **CORS is `*`** in `.env.example`. It must be restricted for production.

---

## 4. Verify Commands

Run these from the repo root. Run every one that applies to your change.

```bash
# Backend: the app imports and builds cleanly
.venv/bin/python -c "import app.main"

# Migrations: environment loads (no DB needed)
.venv/bin/alembic heads

# Frontend: type-check + production build, then lint
(cd frontend && npm run build && npm run lint)

# Compose file is valid
docker compose config -q
```

Run the backend locally with `./run.sh` and the frontend with `cd frontend && npm run dev` (port 3000).

---

## 5. Changelogs

Path: `changelogs/YYYY-MM-DD_<task_slug>.md`. Create one file per task. If you're continuing the same task on the same day, update that day's file.

Template (use exactly these three sections):

```markdown
# <Title>

**Date**: YYYY-MM-DD

## 1. Changes Made
- `path/to/file`: what changed.

## 2. Why the Change Was Made (Rationale)
- The user's intent, the problem being solved, and why you chose this approach over the alternatives.

## 3. Things to Lookout for in Future Development
- Edge cases, follow-ups, migration prerequisites, breaking changes.
```
