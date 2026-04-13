"""
common/jwt_utils.py — Paths Games JWT verification

Verifies HS256 JWT access tokens using only the Python standard library
(no PyJWT dependency required on Lambda).

Also supports legacy MOCK_ACCESS_{uuid} tokens for dev convenience.

Expected JWT claims (issued by the Java backend):
  sub      — user UUID
  username — display name
  role     — ADMIN | PLAYER
  type     — "access"
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


def _b64url_decode(s):
    """Decode base64url (padding-agnostic)."""
    s += '=' * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def verify_access_token(token):
    """
    Verify a Bearer token and return a normalised dict:
        { "uuid": "...", "username": "...", "role": "...", "source": "jwt"|"mock" }
    Returns None if the token is invalid / expired / not an access token.
    """
    if not token:
        return None

    # ── 1. Legacy mock tokens (for Lambda-created guests / dev seed) ──
    if token.startswith('MOCK_ACCESS_'):
        user_uuid = token[len('MOCK_ACCESS_'):]
        return {
            'uuid':     user_uuid,
            'username': None,       # caller must look up from DB
            'role':     None,       # caller must look up from DB
            'source':   'mock',
        }

    # ── 2. Real HS256 JWT ──
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        header_b64, payload_b64, sig_b64 = parts

        # verify signature
        signing_input = f'{header_b64}.{payload_b64}'.encode('utf-8')
        secret_bytes = JWT_SECRET.encode('utf-8') if isinstance(JWT_SECRET, str) else JWT_SECRET
        expected_sig = hmac.new(secret_bytes, signing_input, hashlib.sha256).digest()
        actual_sig   = _b64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        # decode payload
        payload = json.loads(_b64url_decode(payload_b64))

        # check type
        if payload.get('type') != 'access':
            return None

        # check expiration
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
