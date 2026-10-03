# Remove SSO Option and Add 30-Day Remember Me Support

**Date**: 2026-10-03

## 1. Changes Made
- `app/schemas/auth.py`: Added optional `remember_me: bool = False` to `UserLogin` Pydantic schema.
- `app/api/v1/endpoints/auth.py`: Updated `/api/v1/auth/login` to compute `expires_delta = timedelta(days=30)` when `remember_me` is true; otherwise tokens default to the standard 24-hour expiration (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- `frontend/src/components/AuthScreen.tsx`:
  - Removed the SSO button from the social auth buttons section, keeping Google and GitHub.
  - Forwarded `remember_me: rememberMe` in the JSON login request payload to `/api/v1/auth/login`.
  - Added token storage segregation: saves token in `localStorage` when `remember_me` is checked (and clears `sessionStorage`), or in `sessionStorage` when unchecked (and clears `localStorage`).
- `frontend/src/index.css`: Updated `.social-login-grid` to `grid-template-columns: repeat(2, 1fr)` for balanced two-button layout after removing SSO.

## 2. Why the Change Was Made (Rationale)
- The user requested removing the SSO option and ensuring support for the 30-day "Remember me" option.
- Previously, JWT access tokens issued by `/api/v1/auth/login` were strictly bounded to 24 hours (`ACCESS_TOKEN_EXPIRE_MINUTES = 1440`). Even if the frontend retained the token in `localStorage` for 30 days, the server would reject requests after 1 day with a 401 Unauthorized error. Adding `expires_delta = timedelta(days=30)` on the backend when `remember_me=True` ensures the JWT expiration claim (`exp`) matches the client-side session intent.

## 3. Things to Lookout for in Future Development
- **Long-lived Token Revocation**: Because JWTs are stateless and the 30-day tokens remain cryptographically valid until expiration, consider adding a token revocation list, session table, or refresh token rotation pattern if immediate administrative invalidation of compromised credentials becomes necessary.
- **Password Changes**: When users update their passwords or deactivate their accounts in future iterations, ensure active long-lived tokens are invalidated or validated against a user security stamp / updated timestamp in `/api/v1/auth/me`.
