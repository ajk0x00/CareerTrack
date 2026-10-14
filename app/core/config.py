from functools import lru_cache
import json
from typing import Literal
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from pydantic import computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url_str: str) -> str:
    """Normalizes database URLs for asyncpg compatibility.

    - Replaces postgresql:// and postgres:// with postgresql+asyncpg://
    - Replaces libpq 'sslmode' query parameter with asyncpg's 'ssl' parameter
    - Strips unsupported libpq query parameters like 'channel_binding' and 'gssencmode'
    """
    url_str = url_str.strip()
    if url_str.startswith("postgresql://"):
        url_str = url_str.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url_str.startswith("postgres://"):
        url_str = url_str.replace("postgres://", "postgresql+asyncpg://", 1)

    parsed = urlparse(url_str)
    if not parsed.query:
        return url_str

    query_params = parse_qs(parsed.query, keep_blank_values=True)
    new_params: dict[str, list[str]] = {}

    for k, v in query_params.items():
        k_lower = k.lower()
        if k_lower == "sslmode":
            mode = v[0].lower() if v else "require"
            if mode in ("disable", "false", "0"):
                new_params["ssl"] = ["disable"]
            else:
                new_params["ssl"] = ["require"]
        elif k_lower in ("channel_binding", "gssencmode"):
            continue
        else:
            new_params[k] = v

    new_query = urlencode(new_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    PROJECT_NAME: str = "FastAPI Service"
    VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_V1_PREFIX: str = "/api/v1"

    # Documentation URLs
    DOCS_URL: str | None = "/docs"
    REDOC_URL: str | None = "/redoc"
    OPENAPI_URL: str | None = "/openapi.json"

    # Security & CORS
    ALLOWED_HOSTS: list[str] = ["*"]
    CORS_ORIGINS: list[str] = ["*"]

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "careertrack"
    DATABASE_URL: str | None = None

    # Database Connection Pool
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False

    # JWT Authentication
    JWT_SECRET_KEY: str = "change-this-in-production-to-a-super-secret-key-at-least-32-bytes"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Logging
    LOG_LEVEL: str = "INFO"

    # LLM Settings
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.fireworks.ai/inference/v1"
    LLM_MODEL: str = "accounts/fireworks/models/glm-5p3"
    LLM_TEMPERATURE: float = 0.1

    # LangSmith Observability
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_PROJECT: str = "careertrack"
    LANGCHAIN_ENDPOINT: str = "https://api.smith.langchain.com"

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            return normalize_database_url(str(self.DATABASE_URL))
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @field_validator("ALLOWED_HOSTS", "CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_string_list(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except json.JSONDecodeError:
                    pass
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()

