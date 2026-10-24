from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.types import Receive, Scope, Send

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import close_db_connection
from app.core.logging import setup_logging
from app.mcp.server import create_mcp_asgi_app
from app.services.scheduler import shutdown_scheduler, start_scheduler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager for startup and shutdown events."""
    setup_logging()
    settings = get_settings()
    logger.info("Starting %s in %s mode", settings.PROJECT_NAME, settings.ENVIRONMENT)

    if settings.LANGCHAIN_TRACING_V2 and settings.LANGCHAIN_API_KEY:
        import os
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
        os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT
        logger.info("LangSmith observability enabled for project %s", settings.LANGCHAIN_PROJECT)

    from app.mcp.server import mcp_lifespan

    async with mcp_lifespan():
        start_scheduler()
        yield

    logger.info("Shutting down %s", settings.PROJECT_NAME)
    shutdown_scheduler()
    await close_db_connection()


class HealthCheckBypassTrustedHostMiddleware(TrustedHostMiddleware):
    """Allows operational probes (/healthz) regardless of the Host header,

    while strictly validating host headers for all other routes.
    """

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope.get("path", "").rstrip("/") == "/healthz":
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


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
        allowed_hosts = list(settings.ALLOWED_HOSTS)
        for local_host in ("localhost", "127.0.0.1"):
            if local_host not in allowed_hosts:
                allowed_hosts.append(local_host)
        app.add_middleware(
            HealthCheckBypassTrustedHostMiddleware,
            allowed_hosts=allowed_hosts,
        )

    # Operational Health Check (Liveness & Readiness probe)
    @app.get("/healthz", tags=["Health"], include_in_schema=False)
    async def health_check() -> dict[str, str]:
        return {"status": "healthy"}

    # Include API router
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # Mount Model Context Protocol (MCP) server for AI assistants (SSE & JSON-RPC)
    app.mount("/mcp", create_mcp_asgi_app())

    # Serve built frontend SPA if present (Docker multistage build or local production bundle)
    base_dir = Path(__file__).resolve().parent.parent
    frontend_dist = base_dir / "frontend" / "dist"
    if not frontend_dist.is_dir():
        frontend_dist = Path("frontend/dist").resolve()

    if frontend_dist.is_dir() and (frontend_dist / "index.html").is_file():
        logger.info("Serving frontend SPA from %s", frontend_dist)
        assets_dir = frontend_dist / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str) -> Response:
            if full_path.startswith("api/") or full_path == "api" or full_path.startswith("mcp/") or full_path == "mcp":
                raise HTTPException(status_code=404, detail="Not Found")
            try:
                candidate = (frontend_dist / full_path).resolve()
                if candidate.is_relative_to(frontend_dist) and candidate.is_file():
                    return FileResponse(candidate)
            except Exception:
                pass
            index_html = frontend_dist / "index.html"
            if index_html.is_file():
                return FileResponse(index_html)
            raise HTTPException(status_code=404, detail="Not Found")

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
