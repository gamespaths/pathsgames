# ---------------------------------------------------------------------------
# JwtHelper.py — Robot Framework library that generates admin JWT tokens
# for testing admin-protected endpoints in the dev environment.
#
# Usage in .robot / .resource files:
#   Library    ../resources/JwtHelper.py
#
#   ${token}=    Generate Admin Token
# ---------------------------------------------------------------------------
import uuid
import time
import jwt  # PyJWT


# Dev secret from application.yml (default when JWT_SECRET env var is not set)
_DEV_SECRET = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!"
_ALGORITHM = "HS256"
_ACCESS_TOKEN_MINUTES = 30


def generate_admin_token(
    user_uuid=None,
    username="test_admin",
    role="ADMIN",
    secret=_DEV_SECRET,
    minutes=_ACCESS_TOKEN_MINUTES,
):
    """Return a signed HS256 JWT access token with the given claims.

    The token mirrors the claims produced by ``JwtTokenProvider.generateAccessToken``
    in the Java backend:

    - ``jti``      – random UUID (token identifier)
    - ``sub``      – user UUID
    - ``username`` – display name
    - ``role``     – ``ADMIN`` or ``PLAYER``
    - ``type``     – ``access``
    - ``iat``      – issued-at (epoch seconds)
    - ``exp``      – expiry (epoch seconds, now + *minutes*)
    """
    now = int(time.time())
    payload = {
        "jti": str(uuid.uuid4()),
        "sub": user_uuid or str(uuid.uuid4()),
        "username": username,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + minutes * 60,
    }
    return jwt.encode(payload, secret, algorithm=_ALGORITHM)
