# Merge Resume and Job Expiry Migration Heads

**Date**: 2026-10-25

## 1. Changes Made
- `alembic/versions/21926661fcc7_merge_resume_documents_and_job_expiry_.py`: Added a merge revision with `down_revision = ('463ed55ace41', 'b7c41d9a2f10')` and empty `upgrade()`/`downgrade()` bodies. No schema change.

## 2. Why the Change Was Made (Rationale)
- PR #1 (`feature/resume-from-career-data`) and PR #2 (`feature/job-expiry-sweep`) both branched their migrations off `ca60cb1b1d78`. Merging both PRs left two heads in the graph, and `alembic upgrade head` failed with "Multiple head revisions are present for given argument 'head'", which blocks any deployment that runs migrations.
- A merge revision is Alembic's supported way to rejoin a forked graph without rewriting or reordering migrations that may already be applied in an environment. Rewriting either existing revision would be unsafe for any database that has already run it.
- Verified end to end on a scratch database: all 11 original revisions, then both branches, then the merge, resolving to the single head `21926661fcc7`, and `alembic downgrade base` followed by `upgrade head` round-trips cleanly.

## 3. Things to Lookout for in Future Development
- Any future feature branch must be rebased on `main` (and re-run `alembic revision --autogenerate`) after another branch that adds a migration merges, otherwise the fork reappears. Run `alembic heads` before opening a PR: it must print exactly one head.
- PostgreSQL cannot roll back DDL in a failed multi-statement migration, so a partially applied revision leaves `alembic_version` stale. If `upgrade head` fails midway, inspect the schema before restamping; do not blindly stamp.
- A development database that was switched between the two feature branches can disagree with `alembic_version` (for example a `resumes` table created while the resume branch was checked out, then the version marker moved back by the other branch). Repair that locally with `alembic stamp <revision matching the real schema>`; production databases are unaffected because they never ran the unmerged branch.
- This revision is intentionally empty. Do not add statements to it; new schema changes belong in a new revision on top of `21926661fcc7`.
