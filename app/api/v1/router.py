"""API v1 root router.

Mount feature-specific routers here as your application grows.
Example:
    from app.api.v1.endpoints import auth
    api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
"""

from fastapi import APIRouter

api_router = APIRouter()
