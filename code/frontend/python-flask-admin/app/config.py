"""Configuration for the Flask admin console.

The admin console talks ONLY to ``/api/admin/**`` endpoints, served on the
dedicated admin port 8044 (not the public 8042 player API).
"""
import os


class Config:
    # Default admin backend base url; overridable per-session from the login page.
    ADMIN_BASE_URL = os.environ.get("ADMIN_BASE_URL", "http://localhost:8044").rstrip("/")

    SECRET_KEY = os.environ.get("SECRET_KEY", "paths-games-flask-admin-dev-secret")

    # HTTP timeout (seconds) for backend calls.
    BACKEND_TIMEOUT = float(os.environ.get("BACKEND_TIMEOUT", "15"))
