# Two-Stage Job Posting Expiry and Scheduled Cleanup

**Date**: 2026-10-25

## 1. Changes Made
- `app/models/job.py`: Added nullable `expired_at` (`DateTime(timezone=True)`) to `Job` as the only liveness marker (no boolean flag), plus a composite `Index("ix_jobs_status_created_at", "status", "created_at")` in `__table_args__` for the sweep.
- `alembic/versions/463ed55ace41_add_job_expiry.py`: Added and applied migration adding `jobs.expired_at` and `ix_jobs_status_created_at`; downgrade drops the index then the column. Autogenerate also proposed dropping the unrelated `resumes` table (present in the local DB but not in this branch's metadata), which was removed by hand.
- `app/core/config.py`: Added `JOB_EXPIRY_DAYS=10`, `JOB_PURGE_DAYS=40`, `JOB_MAINTENANCE_ENABLED=True`, `JOB_MAINTENANCE_HOUR=3`, `JOB_MAINTENANCE_TZ="UTC"`.
- `.env.example`: Documented and added the same five keys, explaining the two-stage lifecycle.
- `app/services/job_lifecycle.py`: New service with `MaintenanceResult`, `run_maintenance()` (own session, two set-based statements, INFO summary log) and the shared `expires_at()` / `purge_at()` helpers. Interval arithmetic uses a bound `timedelta`, never a formatted SQL string.
- `app/services/scheduler.py`: New module-level `AsyncIOScheduler` lifecycle (`start_scheduler()` / `shutdown_scheduler()`), a single `job_lifecycle_maintenance` cron job at `JOB_MAINTENANCE_HOUR:00` in `JOB_MAINTENANCE_TZ`, `max_instances=1`, `coalesce=True`, and an immediate `next_run_time` so a restart catches up.
- `app/main.py`: Starts the scheduler inside the `mcp_lifespan` block and shuts it down before disposing the database engine.
- `requirements.txt` / `pyproject.toml`: Added `apscheduler>=3.11,<4` (installed in `.venv`).
- `app/schemas/job.py`: `JobResponse` gained `expired_at`, `expires_at`, `purge_at`; `JobPipelineSummary` gained `expired_recently`.
- `app/api/v1/endpoints/jobs.py`: Live-only filtering on list/get, `include_expired` query params, derived `expires_at`/`purge_at` for `saved` jobs only, live-only stage counts plus `expired_recently`, and `POST /api/v1/jobs/{job_id}/restore`.
- `app/mcp/tools.py`: Untouched by design. Expiry is server-derived from `jobs.created_at`; MCP agents can neither set nor bypass it.

## 2. Why the Change Was Made (Rationale)
- Saved postings pile up indefinitely and clutter the pipeline. A two-stage window gives users a grace period to follow up before a posting silently disappears, then removes stale rows for good.
- Both windows measure from `jobs.created_at`, which never moves, so no per-row bookkeeping is needed and the sweep is a constant two statements regardless of table size. A boolean flag would have added a second source of truth; `expired_at IS NULL` is the single liveness predicate.
- Running the sweep as one set-based SQL pair (instead of scheduling per posting) keeps the scheduler to exactly one entry and avoids unbounded job counts; `UPDATE`/`DELETE` also let the composite `(status, created_at)` index do the filtering.
- Expiry only applies to `saved` jobs: once a user applies, interviews, or gets an offer, the record is theirs to keep.
- `expires_at()` / `purge_at()` are shared between the sweep and the API so the UI's countdown can never drift from the retention policy configured on the server.

## 3. Things to Lookout for in Future Development
- **First sweep after deploy hides old data**: every `saved` row older than 10 days becomes expired immediately, so the pipeline appears to lose rows. At 40 days those rows are deleted. A row that is already past both windows is counted in both `expired` and `purged` on the same run (the `UPDATE` runs first), which is why a seeded 45-day row yields `expired` > 1 in a catch-up sweep.
- **Multi-worker deployments**: each Uvicorn worker starts its own scheduler. `run_maintenance` is idempotent (guarded by `expired_at IS NULL` and a `created_at` cutoff), so rows are not double-processed, but a production multi-worker deployment should add an advisory lock or a single-scheduler leader election. `max_instances=1` only guards overlap within a process.
- **`created_at` never moves**: editing notes, updating the status of a saved job, or re-reading a posting does not reset its clock. An actively-annotated job that stays `saved` will still expire at 10 days and be purged at 40; users must move it to `applied` (or call the restore endpoint) to keep it.
- **Deletion preserves tailored resumes**: `resumes.job_id` has `ON DELETE SET NULL`, so the eventual hard delete orphans resume rows instead of cascading, keeping exported markdown and history. The `(user_id, job_id)` uniqueness scope means multiple orphaned resumes per user are possible.
- **Testing**: set `JOB_MAINTENANCE_ENABLED=false` to skip the scheduler; the maintenance function itself is not gated by this flag and must be called explicitly in tests.
- **Migration ordering**: the local database was stamped at another branch's head (`b7c41d9a2f10`, not present on this branch); it was re-stamped to `ca60cb1b1d78` before `alembic upgrade head`. The `resumes` table itself was left untouched, but anyone re-running the resume branch's migrations against this database will see its revisions already applied out of band.
- **Restore and expiry scope**: restore clears `expired_at` for any status but only `saved` jobs are ever expired by the sweep. Patch/delete do not filter `expired_at`, so clients holding an ID can still edit or delete an expired row.
