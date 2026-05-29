"""
common/jwt_utils.py — Paths Games JWT verification

Verifies and generates HS256 JWT tokens using only the Python standard library
(no PyJWT dependency required on Lambda).

ALLOW_MOCK_ACCESS env var (default "true"):
  "true"  → accept/generate MOCK_ACCESS_{uuid} and MOCK_REFRESH_{uuid} tokens (dev convenience)
  "false" → only real HS256 JWTs accepted and generated (production-safe)

Expected JWT claims (issued by the Java backend or this module):
  sub      — user UUID
  username — display name
  role     — ADMIN | PLAYER
  type     — "access" | "refresh"
  exp      — expiration (epoch seconds)
"""

import hmac
import hashlib
import base64
import json
import time
import os

JWT_SECRET = os.environ.get(
    'JWT_SECRET',
    'PathsGamesDevSecret2026_MustBeAtLeast32Chars!'
)

ALLOW_MOCK_ACCESS = os.environ.get('ALLOW_MOCK_ACCESS', 'true').lower() not in ('false', '0', 'no')


def _b64url_decode(s):
    """Decode base64url (padding-agnostic)."""
    s += '=' * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


_JWT_HEADER = _b64url_encode(b'{"alg":"HS256","typ":"JWT"}')


def _sign_jwt(payload: dict) -> str:
    body = _b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f'{_JWT_HEADER}.{body}'.encode('utf-8')
    secret_bytes = JWT_SECRET.encode('utf-8') if isinstance(JWT_SECRET, str) else JWT_SECRET
    sig = hmac.new(secret_bytes, signing_input, hashlib.sha256).digest()
    return f'{_JWT_HEADER}.{body}.{_b64url_encode(sig)}'


def generate_access_token(user_uuid, username, role, exp_seconds=1800):
    """Generate a signed HS256 access JWT."""
    now = int(time.time())
    return _sign_jwt({
        'sub':      user_uuid,
        'username': username,
        'role':     role,
        'type':     'access',
        'iat':      now,
        'exp':      now + exp_seconds,
    })


def generate_refresh_token(user_uuid, exp_seconds=15_552_000):
    """Generate a signed HS256 refresh JWT."""
    now = int(time.time())
    return _sign_jwt({
        'sub':  user_uuid,
        'type': 'refresh',
        'iat':  now,
        'exp':  now + exp_seconds,
    })


def verify_refresh_token(token):
    """Verify a refresh token. Returns the user UUID string or None."""
    if not token:
        return None
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f'{header_b64}.{payload_b64}'.encode('utf-8')
        secret_bytes = JWT_SECRET.encode('utf-8') if isinstance(JWT_SECRET, str) else JWT_SECRET
        expected_sig = hmac.new(secret_bytes, signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(expected_sig, _b64url_decode(sig_b64)):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get('type') != 'refresh':
            return None
        exp = payload.get('exp')
        if exp is not None and time.time() > exp:
            return None
        return payload.get('sub')
    except Exception:
        return None


def verify_access_token(token):
    """
    Verify a Bearer token and return a normalised dict:
        { "uuid": "...", "username": "...", "role": "...", "source": "jwt"|"mock" }
    Returns None if the token is invalid / expired / not an access token.
    MOCK_ACCESS_ tokens are only accepted when ALLOW_MOCK_ACCESS is True.
    """
    if not token:
        return None

    # ── 1. Mock tokens (dev convenience, disabled in prod) ──
    if token.startswith('MOCK_ACCESS_'):
        if not ALLOW_MOCK_ACCESS:
            return None
        user_uuid = token[len('MOCK_ACCESS_'):]
        return {
            'uuid':     user_uuid,
            'username': None,
            'role':     None,
            'source':   'mock',
        }

    # ── 2. Real HS256 JWT ──
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        header_b64, payload_b64, sig_b64 = parts

        signing_input = f'{header_b64}.{payload_b64}'.encode('utf-8')
        secret_bytes = JWT_SECRET.encode('utf-8') if isinstance(JWT_SECRET, str) else JWT_SECRET
        expected_sig = hmac.new(secret_bytes, signing_input, hashlib.sha256).digest()
        actual_sig   = _b64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload = json.loads(_b64url_decode(payload_b64))

        if payload.get('type') != 'access':
            return None

        exp = payload.get('exp')
        if exp is not None and time.time() > exp:
            return None

        return {
            'uuid':     payload.get('sub'),
            'username': payload.get('username'),
            'role':     payload.get('role'),
            'source':   'jwt',
        }
    except Exception:
        return None
