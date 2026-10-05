# Frontend UI for User Preferences (Backend-Aligned)

**Date**: 2026-10-03

## 1. Changes Made
- `frontend/src/types/workspace.ts`: Added `PreferenceImportance` (`'low' | 'medium' | 'high' | 'critical'`), `PreferenceItem`, `PreferenceCreateInput`, and `PreferenceUpdateInput` interfaces aligning with the backend `Preference` model and schemas.
- `frontend/src/components/workspace/settings/PreferencesTab.tsx`: Redesigned the Career Preferences tab to directly integrate with `/api/v1/preferences`:
  - Implemented live synchronization: loads list of preferences on mount with support for filtering by importance level (`all`, `critical`, `high`, `medium`, `low`).
  - Added collapsible "Add Preference" drawer with title, description, and interactive importance selectors.
  - Implemented in-place inline card editing with `PATCH /api/v1/preferences/{id}`.
  - Implemented deletion with `DELETE /api/v1/preferences/{id}` and toast notifications.
  - Added curated starter preset templates that pre-populate the creation form on click.
- `frontend/src/components/workspace/SettingsModal.tsx`: Passed the active authentication `token` to `PreferencesTab`.
- `frontend/src/index.css`: Added styling for preference cards, importance badges (`critical`, `high`, `medium`, `low`), creation drawers, inline editing cards, and suggestion grids. Fixed "Add Preference" button layout wrapping, input typography, focus rings, and custom cancel/save button states.

## 2. Why the Change Was Made (Rationale)
- The user requested updating the frontend UI to match the newly implemented backend user preferences data structure (`title`, `description`, and `importance`).
- Previously, the Preferences tab rendered a static form storing an arbitrary single object in client state without any backend persistence.
- Aligning the frontend with the backend REST endpoints allows users to manage multiple discrete preferences (remote work constraints, salary floors, preferred tech stacks, and domain restrictions) backed by PostgreSQL persistence.

## 3. Things to Lookout for in Future Development
- **Resume Tailoring Prompt Injection**: Future generative prompt builders can read all `critical` and `high` preferences from `/api/v1/preferences` and inject them as strict negative/positive constraints into LLM resume tailoring prompts.
- **Importance Sort Order**: If users request custom reordering or drag-and-drop priorities, a `priority_order` or `rank` column could be added to the `preferences` table.
