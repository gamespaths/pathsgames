from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional


class Settings(BaseSettings):
    app_name: str = "paths-game-backend-python"
    env: str = "development"
    port: int = 8042
    version: str = "0.14.2"  
    

    # >0.12.5 change version here

    # Auth
    jwt_secret: str = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!"
    access_token_minutes: int = 30
    refresh_token_days: int = 7

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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
