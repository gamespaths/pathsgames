"""Application configuration.

Values are read from environment variables so the same code runs against the
bundled mock data (default) or a live Java backend, mirroring the react-game
``src/api/client.js`` behaviour.
"""
import os

# Sentinel meaning "no backend — use the bundled mock JSON" (react MOCK_SERVER).
MOCK_SERVER = "mock"


class Config:
    # "mock" => bundled JSON; otherwise an http(s) base url, e.g. http://localhost:8042
    BASE_URL = os.environ.get("BASE_URL", MOCK_SERVER).rstrip("/")

    # Google Tag Manager container id (e.g. "GTM-XXXXXXX"). Empty disables GTM.
    GTM_ID = os.environ.get("GTM_ID", "")

    # Flask session signing key. Override in production via env.
    SECRET_KEY = os.environ.get("SECRET_KEY", "paths-games-flask-dev-secret")

    # How long an anti-bot pass stays valid (seconds). Mirrors turnstilePass (30 min).
    HUMAN_TTL = int(os.environ.get("HUMAN_TTL", "1800"))

    # Network timeout (seconds) for optional backend calls.
    BACKEND_TIMEOUT = float(os.environ.get("BACKEND_TIMEOUT", "5"))

    # Default UI language when no cookie is set.
    DEFAULT_LANG = os.environ.get("DEFAULT_LANG", "en")
