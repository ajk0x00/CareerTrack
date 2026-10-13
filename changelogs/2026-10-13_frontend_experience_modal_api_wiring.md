# Frontend Experience Modal Backend API Wiring and Company Dropdown

**Date**: 2026-10-13

## 1. Changes Made
- `frontend/src/types/workspace.ts`: Added TypeScript interfaces `ExperienceLogItem`, `ExperienceLogCreateInput`, and `ExperienceLogUpdateInput`.
- `frontend/src/components/workspace/ExperienceModal.tsx`:
  - Connected the component to `/api/v1/experience-logs` for fetching, creating (`POST`), editing (`PATCH`), and deleting (`DELETE`) experience logs.
  - Connected to `/api/v1/companies` to fetch the user's recorded employers.
  - Replaced the freeform company text input with a `<select>` dropdown displaying saved companies (plus an option to specify custom companies).
  - Removed obsolete form textboxes (Role, Employment Period, and Location & Type) to strictly align the modal with the backend schema (`company_name` and `description`).
  - Updated experience record cards to render company name, formatted creation date, and experience description with edit and delete capabilities.
  - Added search/filtering by company or keyword across experience entries.

## 2. Why the Change Was Made (Rationale)
- The user requested wiring the frontend to the backend Experience Log API implementation, removing non-existent fields (Role, Period, Location), and displaying a dropdown for company selection.
- Sourcing companies from `/api/v1/companies` prevents manual re-typing and maintains consistency with the user's Career Timeline settings while allowing custom entries when needed.

## 3. Things to Lookout for in Future Development
- **ATS Tailoring Engine**: As the resume workspace integrates experience logs into prompt construction or canvas rendering, `ExperienceLogItem` entries can be passed directly to the generator.
