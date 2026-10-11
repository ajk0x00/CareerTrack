# WorkLog Data Import Helper Script

**Date**: 2026-10-11

## 1. Changes Made
- `data/worklog_export.json`: Saved the exported JSON dataset containing users, companies, skills, tags, work logs, and log-tag associations from the legacy workLog service.
- `scripts/import-data`: Created an async helper CLI script to import exported workLog JSON data into local or production PostgreSQL databases:
  - Normalizes PostgreSQL connection URLs (ensuring `postgresql+asyncpg://` protocol).
  - Verifies presence of core CareerTrack tables (`users`, `companies_worked`, `skills`).
  - Ensures supplementary tables (`tags`, `work_logs`, `log_tags`) and indexes exist with foreign key cascade rules.
  - Resolves users by email (`ajk0x00@gmail.com`) or creates them, mapping user IDs.
  - Maps companies to `companies_worked` (case-insensitive deduplication), retaining employment timeline inference.
  - Maps skills, converting legacy numeric proficiencies (1–5) to CareerTrack string proficiencies (`beginner`, `intermediate`, `advanced`, `expert`).
  - Inserts tags and work logs (accomplishments) with native `datetime` parsing for PostgreSQL `TIMESTAMPTZ` columns.
  - Preserves log-tag association pairs in `log_tags`.
  - Resets and synchronizes all PostgreSQL auto-increment sequences (`pg_get_serial_sequence` and `setval`) to avoid future primary key collisions.
  - Supports `--dry-run` for safe preview simulation without writing any database modifications.
  - Supports custom database targets via `--db-url <URL>` or the `DATABASE_URL` environment variable, plus user email overriding via `--email <email>`.

## 2. Why the Change Was Made (Rationale)
- The user provided a complete JSON export from the legacy workLog system and requested a production-ready helper script to import this history into the careerTrack database in production.
- Automating this migration with deduplication and sequence synchronization ensures all historical work logs, accomplishments, tags, skills, and employer timelines are fully preserved and linked without primary key collisions or foreign key violations.
- Providing a `--dry-run` flag allows operators to inspect and validate the plan against any production database before committing changes.

## 3. Things to Lookout for in Future Development
- **Database Migrations Prerequisite**: Run `alembic upgrade head` on the target database before importing so that core tables (`users`, `companies_worked`, `skills`) exist.
- **Connection Driver**: If supplying a connection string directly via CLI or `DATABASE_URL`, the script automatically rewrites `postgresql://` and `postgres://` to `postgresql+asyncpg://`.
- **Foreign Key Consistency**: The script links `work_logs.company_id` to the matching record in `companies_worked.id`. If a company is later deleted, `ON DELETE SET NULL` ensures work logs remain intact.
