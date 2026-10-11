"""API v1 root router."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    api_clients,
    auth,
    companies,
    jobs,
    preferences,
    profile,
    skills,
    workspaces,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(api_clients.router, prefix="/api-clients", tags=["API Clients"])
api_router.include_router(companies.router, prefix="/companies", tags=["Companies Worked In"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
api_router.include_router(preferences.router, prefix="/preferences", tags=["Preferences"])
api_router.include_router(profile.router, prefix="/profile", tags=["Profile"])
api_router.include_router(skills.router, prefix="/skills", tags=["Skills"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])


