from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

# Root project .env (two levels up from code/backend/python/)
_ROOT_ENV = Path(__file__).resolve().parent.parent.parent.parent.parent / ".env"


class Settings(BaseSettings):
    app_name: str = "paths-game-backend-python"
    env: str = "development"
    port: int = 8042
    version: str = "0.20.0"  
    

    # >0.12.5 change version here

    # Auth
    jwt_secret: str = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!"
    access_token_minutes: int = 30
    refresh_token_days: int = 7

    # Cloudflare Turnstile secret key. Empty = validation disabled (dev bypass).
    turnstile_secret_key: str = ""

    # Dev-only test endpoints: POST /api/dev/cleanup and the optional
    # X-Test-Marker header on POST /api/auth/guest. Disable in production by
    # setting the env var DEV_TEST_ENDPOINTS_ENABLED=false.
    dev_test_endpoints_enabled: bool = True

    # CORS — comma-separated list of allowed origins, or "*" for all
    cors_allowed_origins: str = "*"

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "pathsgames"
    db_user: str = "pathsgames"
    db_password: str = "pathsgames"
    db_path: str = "database.sqlite"  # Default for SQLite

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse cors_allowed_origins into a list."""
        if self.cors_allowed_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    # Load root .env first (lower priority), then local .env (higher priority).
    # System env vars always win over both files.
    model_config = SettingsConfigDict(
        env_file=[str(_ROOT_ENV), ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
