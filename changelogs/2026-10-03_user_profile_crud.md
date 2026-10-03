# User Profile Model Extension & CRUD API

**Date**: 2026-10-03

## 1. Changes Made
- `app/models/user.py`: Extended `User` model with profile fields `name` (`String(255)`), `phone` (`String(50)`), `socials` (`JSON`), and `address` (`JSON`).
- `alembic/versions/b4ad5b875685_add_profile_fields_to_users_table.py`: Created and applied Alembic migration to add `name`, `phone`, `socials`, and `address` columns to the `users` table.
- `app/schemas/profile.py`: Implemented strict validation schemas:
  - `AddressSchema`: Validates street, city, state, postal code, and country with `extra="forbid"`.
  - `SocialsSchema`: Validates social platforms and strictly enforces HTTP/HTTPS URL formatting and domain structure.
  - `ProfileBase`, `ProfileCreate`, `ProfileUpdate`: Enforces strict name validation (unicode letters, hyphens, spaces, requiring alphabetic characters), E.164 phone formatting (7-15 digits), RFC email regex validation, and forbids unexpected extra root fields.
  - `ProfileResponse`: Returns user profile data with ORM serialization support (`from_attributes=True`).
- `app/schemas/auth.py`: Updated `UserResponse` to include the new profile fields.
- `app/schemas/__init__.py`: Re-exported profile schemas (`AddressSchema`, `SocialsSchema`, `ProfileBase`, `ProfileCreate`, `ProfileUpdate`, `ProfileResponse`).
- `app/api/v1/endpoints/profile.py`: Implemented authenticated CRUD API endpoints:
  - `GET /api/v1/profile`: Retrieve the caller's profile.
  - `POST /api/v1/profile`: Initialize or set user profile details.
  - `PUT /api/v1/profile`: Full profile update/replacement with email conflict validation.
  - `PATCH /api/v1/profile`: Partial profile update for specified fields with email conflict validation.
  - `DELETE /api/v1/profile`: Clear/reset optional profile details (`204 No Content`).
  - `GET /api/v1/profile/{user_id}`, `PUT /api/v1/profile/{user_id}`, `PATCH /api/v1/profile/{user_id}`, `DELETE /api/v1/profile/{user_id}`: Resource-scoped profile operations with ownership authorization guards.
- `app/api/v1/router.py`: Mounted the profile router under `/api/v1/profile` with tag `Profile`.

## 2. Why the Change Was Made (Rationale)
- The user requested extending the backend `User` model with user profile attributes (`name`, `phone`, `email`, `socials`, `address`) backed by strict validation and a full CRUD API.
- Standard library regular expressions and Pydantic validators were used to maintain strict data integrity without introducing unapproved runtime dependencies.
- Standard async session rules were preserved: changes are flushed using `await db.flush()` and reloaded via `await db.refresh(current_user)` to cleanly populate server-generated timestamp fields like `updated_at` without triggering greenlet lazy-load errors.
- Email uniqueness is explicitly checked when updating the profile email address to prevent duplicate account collisions.

## 3. Things to Lookout for in Future Development
- **Database Migrations on New Environments**: Ensure `alembic upgrade head` is executed when spinning up fresh databases to apply revision `b4ad5b875685`.
- **JSON Column Backwards Compatibility**: `socials` and `address` default to empty dictionaries in Python/JSON and accept structured schemas; future database query optimizations on specific nested keys (such as filtering by country or LinkedIn handle) may benefit from PostgreSQL JSONB indexes if query volume grows.
- **Frontend Integration**: Frontend profile forms should consume `/api/v1/profile` and provide error handling matching the 422 validation response schemas.
