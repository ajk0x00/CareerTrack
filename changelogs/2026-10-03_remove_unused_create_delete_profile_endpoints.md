# Remove Unused Profile Create & Delete Endpoints

**Date**: 2026-10-03

## 1. Changes Made
- `app/api/v1/endpoints/profile.py`: Removed unused `POST /api/v1/profile` (Create), `PUT /api/v1/profile` (Full Replace), `DELETE /api/v1/profile` (Clear), and the speculative resource-scoped `/{user_id}` endpoints (`GET`, `PUT`, `PATCH`, `DELETE`). Kept only the active and necessary `GET /api/v1/profile` and `PATCH /api/v1/profile` routes.
- `app/schemas/profile.py`: Removed the unused `ProfileCreate` schema, retaining `ProfileBase`, `ProfileUpdate`, and `ProfileResponse`.
- `app/schemas/__init__.py`: Removed `ProfileCreate` from exported symbols.
- `frontend/src/components/workspace/settings/AccountTab.tsx`: Removed the Danger Zone profile reset UI card, the unused `DELETE /api/v1/profile` fetch call, and related state flags.
- `frontend/src/components/workspace/SettingsModal.tsx`: Cleaned up unused `handleProfileReset` and removed the `onProfileReset` prop passed to `AccountTab`.

## 2. Why the Change Was Made (Rationale)
- The user asked whether Create and Delete endpoints are used in the User/Profile model, and requested their removal if unused.
- User creation is strictly handled by `POST /api/v1/auth/register` (account signup) and there is no user account deletion endpoint.
- For profile attributes stored directly on the `User` model, the client only fetches (`GET /api/v1/profile`) and modifies fields (`PATCH /api/v1/profile`). `POST /api/v1/profile` and the `/{user_id}` routes were never called.
- Removing these unused endpoints aligns with Rule 3 of `AGENTS.md` ("Make the smallest change that works. Don't add placeholder or sample code, unused abstractions, or speculative features.").

## 3. Things to Lookout for in Future Development
- Any future administrative features requiring profile manipulation across other user accounts should introduce dedicated admin routers with role-based access control (RBAC) rather than unauthenticated user-id path parameters.
- Profile field modifications should continue to go through `PATCH /api/v1/profile`.
