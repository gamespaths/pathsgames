# ---------------------------------------------------------------------------
# JwtHelper.py — Robot Framework library for the tokens of the suites.
#
# v1.2.0 — every token must belong to a user of the backend's database, with the
# role read from the DB and iss/aud checked: "Generate Admin Token" asks the
# backend for a real admin user (POST {ADMIN_BASE_URL}/api/dev/admin-token, only
# with the test endpoints on, the same service as the admin bootstrap tool) and
# caches it per run; "Generate Player Token" still mints HS256 tokens locally for
# the refusal tests (iss/aud copied from a real token of the backend under test).
#
#   ${token}=    Generate Admin Token
#   ${token}=    Generate Player Token    issuer=${iss}    audience=${aud}
# ---------------------------------------------------------------------------
import base64
import json
import os
import time
import uuid

import jwt  # PyJWT
import requests
import urllib3
from requests.adapters import HTTPAdapter

from HttpRetryHelper import build_retry

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Dev secret from application.yml; v0.41.0: only the fallback when JWT_SECRET is not exported
_DEV_SECRET = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!"
_ALGORITHM = "HS256"
_ACCESS_TOKEN_MINUTES = 30
ROBOT_ADMIN_NICKNAME = "robot_admin"
_ADMIN_CACHE = {}


def _robot_variable(name, default=None):
    try:
        from robot.libraries.BuiltIn import BuiltIn
        value = BuiltIn().get_variable_value("${" + name + "}")
        return default if value is None else value
    except Exception:  # noqa: BLE001 — outside a Robot run
        return os.environ.get(name, default)


def generate_admin_token(nickname=ROBOT_ADMIN_NICKNAME, admin_base_url=None):
    """v1.2.0 — the token of a real admin user, created (or found again) by the backend through
    POST /api/dev/admin-token; one call per run and backend URL."""
    base = (admin_base_url or _robot_variable("ADMIN_BASE_URL", "http://localhost:8044")).rstrip("/")
    key = (base, nickname)
    if key not in _ADMIN_CACHE:
        session = requests.Session()
        session.mount(base, HTTPAdapter(max_retries=build_retry(_robot_variable("HTTP_MAX_RETRIES", 5),
                      _robot_variable("HTTP_READ_RETRIES", 3), _robot_variable("HTTP_BACKOFF_FACTOR", 1))))
        response = session.post(f"{base}/api/dev/admin-token", json={"nickname": nickname},
                                timeout=float(_robot_variable("HTTP_POST_TIMEOUT", 40)), verify=False)
        if response.status_code != 201:
            raise AssertionError(f"POST {base}/api/dev/admin-token answered {response.status_code}: "
                                 f"{response.text[:200]}")
        _ADMIN_CACHE[key] = response.json()["accessToken"]
    return _ADMIN_CACHE[key]


def token_claims(token):
    """The claims of a JWT, unverified (iss/aud of the backend under test)."""
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))


def generate_player_token(
    user_uuid=None,
    username="test_player",
    role="PLAYER",
    issuer=None,
    audience="paths-games",
    secret=None,
    minutes=_ACCESS_TOKEN_MINUTES,
):
    """Return a signed HS256 access token with the given claims (v1.2.0 with iss and aud).

    ``secret`` defaults to env JWT_SECRET (the run scripts export it), else the dev one. The
    claims mirror the backends: jti, iss, aud, sub, username, role, type=access, iat, exp."""
    now = int(time.time())
    payload = {
        "jti": str(uuid.uuid4()),
        "sub": user_uuid or str(uuid.uuid4()),
        "username": username,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + int(minutes) * 60,
    }
    if issuer:
        payload["iss"] = issuer
    if audience:
        payload["aud"] = audience
    key = secret or os.environ.get("JWT_SECRET") or _DEV_SECRET
    return jwt.encode(payload, key, algorithm=_ALGORITHM)
