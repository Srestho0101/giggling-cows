from pathlib import Path
from typing import List, Union
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    PROJECT_NAME: str = "Cow Farm Management System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./cow_farm.db"
    
    # Supabase / Auth
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = "dev-supabase-jwt-secret-replace-in-env"
    SUPABASE_JWT_ALGORITHM: str = "HS256"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://giggling-cows.vercel.app",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return []

    # Localization defaults
    DEFAULT_CURRENCY: str = "BDT"
    DEFAULT_CURRENCY_SYMBOL: str = "৳"
    DEFAULT_LOCALE: str = "en"

    model_config = SettingsConfigDict(
        # Load the project-level .env regardless of whether commands are run
        # from the repository root or the backend directory.
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @property
    def async_database_url(self) -> str:
        """Return a URL accepted by SQLAlchemy's async engine for Supabase or local Postgres."""
        url = self.DATABASE_URL.strip()
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        candidate = urlsplit(url)
        if candidate.scheme and candidate.hostname:
            params = dict(parse_qsl(candidate.query, keep_blank_values=True))
            if candidate.hostname.endswith(".supabase.com") or candidate.port == 6543:
                params.pop("pgbouncer", None)
                params.pop("sslmode", None)
                return urlunsplit((
                    candidate.scheme,
                    candidate.netloc,
                    candidate.path,
                    urlencode(params),
                    candidate.fragment,
                ))
        return url

    @property
    def database_connect_args(self) -> dict:
        """Require TLS for Supabase connections; retain SQLite thread options."""
        if self.DATABASE_URL.startswith("sqlite"):
            return {"check_same_thread": False}

        host = urlsplit(self.DATABASE_URL).hostname or ""
        port = urlsplit(self.DATABASE_URL).port
        if host.endswith(".supabase.com") or port == 6543:
            # Supabase's pooler (PgBouncer) rejects asyncpg's prepared-statement cache.
            return {
                "ssl": "require",
                "statement_cache_size": 0,
                "prepared_statement_cache_size": 0,
                "command_timeout": 20,
            }
        return {"command_timeout": 20}


settings = Settings()