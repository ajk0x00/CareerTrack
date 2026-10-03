# React Router Navigation & Protected Routes

**Date**: 2026-10-03

## 1. Changes Made
- `AGENTS.md`: Added `react-router-dom` to the approved dependencies list.
- `frontend/package.json` & `frontend/package-lock.json`: Added `react-router-dom` (`^7.18.4`).
- `frontend/src/context/AuthContext.ts` & `frontend/src/context/AuthProvider.tsx`: Created decoupled Auth context and provider to manage token/user state, login, and logout cleanly with React Fast Refresh compliance.
- `frontend/src/context/index.ts`: Barrel export for auth context and provider.
- `frontend/src/components/common/ProtectedRoute.tsx`: Route guard ensuring only authenticated users can access `/`, `/pipeline`, `/settings`, `/experience`, and `/skills`, redirecting unauthenticated users to `/login` while preserving location state.
- `frontend/src/components/common/PublicOnlyRoute.tsx`: Route guard ensuring authenticated users attempting to access `/login` are automatically redirected to `/` (or their intended destination).
- `frontend/src/components/AuthScreen.tsx`: Wired `login()` from `useAuth()` and `useNavigate()` to transition to origin routes upon successful authentication or registration.
- `frontend/src/components/workspace/JobPipeline.tsx`: Created a Kanban job application pipeline page supporting status tracking (Saved, Applied, Interviewing, Offer), search filtering, stage progression dropdown, and quick "Tailor" CTA links leading back to `/` with query parameters.
- `frontend/src/components/workspace/WorkspaceNavbar.tsx`: Integrated `useNavigate()` and `useLocation()` for active route indicators and navigation across workspaces (`/` and `/pipeline`).
- `frontend/src/components/workspace/UserMenu.tsx`: Updated dropdown actions to navigate using React Router to `/settings`, `/settings/preferences`, `/pipeline`, and `/login`.
- `frontend/src/components/workspace/SettingsModal.tsx`: Added `initialTab` prop support to activate specific tabs directly from URLs (e.g. `/settings/preferences`, `/settings/profile`, `/settings/optimization`, `/settings/account`).
- `frontend/src/components/workspace/TailoredResumeWorkspace.tsx`: Added support for deep-linked modal paths (`/settings`, `/settings/:tab`, `/experience`, `/skills`) and query parameters (`?company=...&role=...`), with keyboard shortcuts and ESC/backdrop dismissal returning to `/`.
- `frontend/src/components/index.ts`: Re-exported `JobPipeline` and common route guards.
- `frontend/src/App.tsx`: Configured `BrowserRouter`, `AuthProvider`, `ToastProvider`, and route tree with protected workspace routes and public auth route.
- `frontend/src/index.css`: Added styles for the Job Pipeline page, Kanban columns, badges, cards, and responsive layouts.

## 2. Why the Change Was Made (Rationale)
- The user requested adopting React Router for navigating between pages.
- Previously, page transitions and modals were handled exclusively via monolithic root state in `App.tsx`, which did not support browser history (Back/Forward buttons), bookmarks, or deep linking to specific sections or tools.
- Introducing `react-router-dom` with dedicated route guards (`ProtectedRoute`, `PublicOnlyRoute`) provides a standard SPA routing structure, eliminates prop drilling of auth state, and allows deep linking directly into the Job Pipeline or Settings tabs.

## 3. Things to Lookout for in Future Development
- **Vite SPA Fallback**: In production deployments (e.g., Nginx, Caddy, Cloudflare Pages), ensure SPA fallback is enabled so refreshing on `/pipeline` or `/settings` serves `index.html` instead of a 404.
- **Query Parameter Pre-population**: When adding future pipeline or ATS integrations, `?company=...&role=...` query parameters can be expanded to include job ID (`?jobId=...`) to load remote JD content directly.
- **Fast Refresh Rules**: When adding hooks in context modules, keep React components (`AuthProvider.tsx`) and pure context/hook definitions (`AuthContext.ts`) separate to satisfy `oxlint`'s `react(only-export-components)` rule.
