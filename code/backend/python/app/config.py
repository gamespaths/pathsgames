from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

from app.core.services.security.env_rule import is_dev_or_test

#: The committed dev secret: refused at startup outside dev/test (v0.41.0, decision 5).
DEV_JWT_SECRET = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!"
#: v0.41.0 — the Java dev-profile CORS list, the default instead of "*" with credentials.
DEV_CORS_ORIGINS = ",".join([
    "http://localhost:3000", "http://localhost:8042", "http://127.0.0.1:5500",
    "http://localhost:5500", "http://localhost:5172", "http://localhost:5173",
    "http://localhost:5174", "http://localhost:8080", "https://pathsgames.com",
    "https://www.pathsgames.com", "https://pathsgames.com", "https://www.pathsgames.com",
    "null",
])

# Root project .env (two levels up from code/backend/python/)
_ROOT_ENV = Path(__file__).resolve().parent.parent.parent.parent.parent / ".env"


class Settings(BaseSettings):
    app_name: str = "paths-game-backend-python"
    env: str = "development"
    # Bind host for the uvicorn servers. Default loopback for safety in local dev;
    # in Docker/containers set HOST=0.0.0.0 so the published ports are reachable.
    host: str = "127.0.0.1"
    port: int = 8042
    # Dedicated admin port. All /api/admin/** endpoints are served here (and ONLY here);
    # the public app on `port` does not register the admin routers. Lock this port to the
    # owner IP at the network layer (firewall / security group).
    admin_port: int = 8044
    version: str = "0.41.3"


    # >0.12.5 change version here

    # Auth
    jwt_secret: str = DEV_JWT_SECRET
    access_token_minutes: int = 30
    refresh_token_days: int = 7

    # Cloudflare Turnstile secret key. Empty = validation disabled (dev bypass).
    turnstile_secret_key: str = ""

    # Optional Robot-test bypass token, honoured only on dev/test (v0.41.0 env rule); empty = never.
    turnstile_bypass_token: str = ""

    # Step 41 — per-IP and (v0.41.0) per-guest creation limits, 0 = off; defaults 20/20/10, Robot 0.
    rate_limit_guest_per_ip: int = 20
    rate_limit_match_per_ip: int = 20
    rate_limit_window_seconds: int = 3600
    rate_limit_match_per_guest: int = 10
    rate_limit_match_per_guest_window_seconds: int = 86400

    # v0.41.0 — the daily job deleting the guests idle for N days that no match references.
    guest_cleanup_enabled: bool = True
    guest_cleanup_age_days: int = 60
    guest_cleanup_max_per_run: int = 500
    guest_cleanup_hour: int = 0
    guest_cleanup_minute: int = 42
    # v0.41.1 — WARN once per match when its log rows reach this count (check only, 0 = off).
    log_warn_rows: int = 5000
    # v0.41.1 — LIGHT snapshots kept per match, one per time-end (0 = no snapshots).
    snapshot_keep_per_match: int = 10
    # The csrfToken issued with every access token must come back as X-CSRF-TOKEN on
    # POST /api/matches. Same secret as the JWT unless CSRF_SECRET says otherwise.
    csrf_enforced: bool = True
    csrf_secret: str = ""

    # Dev-only endpoints and X-Test-* headers; v0.41.0: unset = on only when env is dev/test.
    dev_test_endpoints_enabled: Optional[bool] = None

    # v0.37.6 — POST /api/admin/stories/catalog writes data/stories-{lang}.json here
    # (e.g. react-game/public/data). Empty = endpoint answers 503.
    catalog_export_dir: str = ""
    catalog_langs: str = "en,it"

    # CORS — comma-separated origins or "*"; v0.41.0 default: the Java dev list, no longer "*".
    cors_allowed_origins: str = DEV_CORS_ORIGINS

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "pathsgames"
    db_user: str = "pathsgames"
    db_password: str = "pathsgames"
    db_path: str = "database.sqlite"  # Default for SQLite

    @model_validator(mode="after")
    def _dev_test_endpoints_from_env(self):
        if self.dev_test_endpoints_enabled is None:
            self.dev_test_endpoints_enabled = is_dev_or_test(self.env)
        return self

    @property
    def is_dev_or_test(self) -> bool:
        return is_dev_or_test(self.env)

    @property
    def catalog_langs_list(self) -> List[str]:
        return [l.strip() for l in self.catalog_langs.split(",") if l.strip()]

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


def check_secrets(current: Optional[Settings] = None) -> None:
    """v0.41.0 — outside dev/test, refuse the committed (or blank) JWT secret; called by _serve only."""
    current = current or settings
    if current.is_dev_or_test:
        return
    if not (current.jwt_secret or "").strip() or current.jwt_secret == DEV_JWT_SECRET:
        raise RuntimeError(
            f"Refusing to start: env '{current.env}' is not dev/test and JWT_SECRET is missing"
            " or the committed default. Set JWT_SECRET to a private random value"
            " (openssl rand -base64 48).")
