# Career Settings Tab & Company Timeline UI

**Date**: 2026-10-05

## 1. Changes Made
- `frontend/src/types/workspace.ts`: Added TypeScript interfaces `CompanyWorkedItem`, `CompanyWorkedCreateInput`, and `CompanyWorkedUpdateInput` matching the backend model and schemas.
- `frontend/src/components/workspace/settings/SettingsSidebar.tsx`: Added `'career'` to `SettingsTabId` and added the **Career** entry (`work_history` icon) to the sidebar navigation items.
- `frontend/src/components/workspace/settings/CompanyForm.tsx`: Created reusable form component supporting both addition and inline editing of companies, with fields for company name, actively working toggle/checkbox, start date, and end date (automatically disabled/omitted when actively working).
- `frontend/src/components/workspace/settings/CompanyTimelineItem.tsx`: Created timeline node component displaying the company name, formatted dates (e.g. `May 2022 – Present`), tenure duration, pulsating active status badge, start/end dates detail footer, inline editing drawer, and delete trigger.
- `frontend/src/components/workspace/settings/CareerTab.tsx`: Created main career tab component featuring:
  - Header with title, description, and `+ Add Company` action toggle.
  - Overview metrics row (Total Companies, Actively Working, Career Span).
  - Quick filter tabs (`All Companies`, `Actively Working`, `Previous Roles`).
  - Vertical timeline stream connected by a continuous rail.
  - Interactive CRUD operations wired to `/api/v1/companies` with toast notifications for add, edit, and delete.
  - Empty state with CTA button.
- `frontend/src/components/workspace/settings/index.ts`: Re-exported `CareerTab`.
- `frontend/src/components/workspace/SettingsModal.tsx`: Mounted and rendered `CareerTab` when `activeTab === 'career'`.
- `frontend/src/index.css`: Added complete styles for `.career-tab-container`, `.career-stats-row`, `.company-form-card`, `.company-timeline-stream`, `.company-timeline-node`, `.company-timeline-dot`, `.company-active-pill`, and associated micro-animations.

## 2. Why the Change Was Made (Rationale)
- The user requested a new "Career" entry in the Settings modal that displays a timeline-like UI with previous and active company data (start date, end date, company name), with full interactive capabilities to add, edit, and delete companies.
- Modularized the feature into reusable subcomponents (`CompanyForm`, `CompanyTimelineItem`, `CareerTab`) adhering to `AGENTS.md` guidelines for clean React architecture.
- Connected the frontend directly to the `/api/v1/companies` REST API created in the prior step, utilizing relative URLs and standard bearer authentication.
- Added client-side date consistency validation (preventing `end_date < start_date` and auto-clearing `end_date` when active) to deliver immediate feedback alongside backend validation.

## 3. Things to Lookout for in Future Development
- **Achievement & Role Association**: Future iterations could link work achievements, metrics, and role titles directly to each company in the timeline to further enhance ATS resume tailoring.
- **Date Picker Localization**: HTML5 `<input type="date">` inputs are utilized for native date controls across desktop and mobile browsers.
