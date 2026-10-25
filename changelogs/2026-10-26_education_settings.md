# Education Settings: Model, CRUD API, Resume Section & Settings Tab

**Date**: 2026-10-26

## 1. Changes Made
- `app/models/education.py`: Added the `Education` model (`education` table) with `id`, `user_id` (FK to `users.id`, `ON DELETE CASCADE`), `degree`, `institution`, `cgpa` as `Numeric(4, 2, asdecimal=False)`, plus `created_at`/`updated_at`.
- `app/models/__init__.py`: Re-exported `Education` in imports and `__all__`.
- `alembic/versions/9343d7397c39_create_education_table.py`: Added the migration creating the `education` table with `ix_education_id` and `ix_education_user_id`; the downgrade drops both indexes and the table. Revision id `9343d7397c39`, parent `21926661fcc7`.
- `app/schemas/education.py`: Added `EducationBase`, `EducationCreate`, `EducationUpdate`, and `EducationResponse` with whitespace-stripping validators, CGPA bounds `0-99.99`, and an at-least-one-field update validator.
- `app/schemas/__init__.py`: Re-exported the four education schemas.
- `app/api/v1/endpoints/education.py`: Added user-scoped `GET /api/v1/education`, `POST /api/v1/education`, `PATCH /api/v1/education/{id}`, and `DELETE /api/v1/education/{id}` with ownership 404s and `flush`-only writes.
- `app/api/v1/router.py`: Mounted the education router at `/education` with the `Education` tag.
- `app/services/resume.py`: `ResumeDraftService.build_draft` now appends an `## Education` section after Skills, newest first, formatted as `- **{degree}, {institution}** (CGPA: {cgpa:.2f})`; omitted when no rows exist and existing `has_*` flags are unchanged.
- `frontend/src/types/workspace.ts`: Added `EducationItem` and `EducationCreateInput`.
- `frontend/src/components/workspace/settings/EducationTab.tsx`: Added the education tab with authenticated loading, inline add/edit form, client-side validation, record cards, confirmation-backed delete, empty state, and toast feedback.
- `frontend/src/components/workspace/settings/SettingsSidebar.tsx`: Added `'education'` to `SettingsTabId` and the Education nav entry (`school` icon) after Career.
- `frontend/src/components/workspace/settings/index.ts`: Re-exported `EducationTab`.
- `frontend/src/components/workspace/SettingsModal.tsx`: Rendered `<EducationTab token={token} />` for the new tab.
- `frontend/src/index.css`: Added education tab, form grid, record card, CGPA badge, and empty-state styles using existing settings tokens and card conventions.

## 2. Why the Change Was Made (Rationale)
- The feature request called for a dedicated Education section in settings with exactly three user fields per record: degree type, institution, and passing CGPA. The model and schemas deliberately exclude dates, location, and field of study so the API surface stays minimal and matches the product definition.
- Education is user-level data, not job-scoped, so the same rows feed every resume draft. Adding the section directly to `ResumeDraftService.build_draft` keeps draft generation deterministic without introducing a new persistence path or a fourth `has_*` flag.
- The router, session handling, ownership checks, and frontend fetch/error patterns mirror the existing skills and career implementations, which keeps behaviour consistent and avoids new dependencies or abstractions.
- The frontend reuses the established `pref-*` form/card classes and only adds education-specific layout classes, so the tab inherits the same visual language as Career and Preferences.

## 3. Things to Lookout for in Future Development
- **Migration order**: This revision depends on the merge head `21926661fcc7`. Rebase and regenerate the migration if another branch merges a new head first; `alembic heads` must stay at exactly one head.
- **CGPA precision**: `Numeric(4, 2)` caps values at `99.99` and stores two decimal places. Values are returned and drafted as floats because `asdecimal=False`; changing that flag would affect both the API payload and the `:.2f` formatting.
- **Ordering**: Both the list endpoint and resume section order by `created_at DESC, id DESC`. Editing a record does not reorder it because `created_at` is unchanged.
- **Resume scope**: Education rows are not scoped to a job. If job-specific education selection is ever needed, the draft service and schema will need a scoping field.
- **Backend process**: The running local uvicorn serves a baked copy of the code without `--reload`, so it must be rebuilt/restarted outside this task before the new `/api/v1/education` route is reachable on port 8000.
