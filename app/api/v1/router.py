"""API v1 root router."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, profile

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(profile.router, prefix="/profile", tags=["Profile"])

