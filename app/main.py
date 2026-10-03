from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import close_db_connection
from app.core.logging import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager for startup and shutdown events."""
    setup_logging()
    settings = get_settings()
    logger.info("Starting %s in %s mode", settings.PROJECT_NAME, settings.ENVIRONMENT)

    yield

    logger.info("Shutting down %s", settings.PROJECT_NAME)
    await close_db_connection()


def create_app() -> FastAPI:
    """FastAPI application factory."""
    settings = get_settings()

    # Disable interactive API docs in production unless explicitly configured
    docs_url = settings.DOCS_URL if not settings.is_production else None
    redoc_url = settings.REDOC_URL if not settings.is_production else None
    openapi_url = settings.OPENAPI_URL if not settings.is_production else None

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        debug=settings.DEBUG,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
        lifespan=lifespan,
    )

    # Security: CORS
    if settings.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Security: Allowed Hosts (enforced when not wildcard)
    if settings.ALLOWED_HOSTS and settings.ALLOWED_HOSTS != ["*"]:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS,
        )

    # Operational Health Check (Liveness & Readiness probe)
    @app.get("/healthz", tags=["Health"], include_in_schema=False)
    async def health_check() -> dict[str, str]:
        return {"status": "healthy"}

    # Include API router
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
