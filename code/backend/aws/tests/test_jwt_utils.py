"""
Unit tests for common/jwt_utils.py — pure functions, no mocking needed.
"""
import base64
import hmac
import hashlib
import json
import time

from common import jwt_utils

SECRET = 'PathsGamesDevSecret2026_MustBeAtLeast32Chars!'


def _make_token(payload, secret=SECRET):
    """Build a signed HS256 JWT for testing."""
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b'=').decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=').decode()
    signing_input = f'{header}.{body}'.encode()
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b'=').decode()
    return f'{header}.{body}.{sig_b64}'


# ── MOCK tokens ────────────────────────────────────────────────────────────────

def test_mock_token_returns_uuid():
    result = jwt_utils.verify_access_token('MOCK_ACCESS_some-uuid-here')
    assert result is not None
    assert result['uuid'] == 'some-uuid-here'
    assert result['source'] == 'mock'

def test_mock_token_role_is_none():
    result = jwt_utils.verify_access_token('MOCK_ACCESS_x')
    assert result['role'] is None
    assert result['username'] is None


# ── valid HS256 JWT ────────────────────────────────────────────────────────────

def test_valid_jwt_returns_claims():
    payload = {
        'sub': 'user-abc',
        'username': 'tester',
        'role': 'PLAYER',
        'type': 'access',
        'exp': int(time.time()) + 3600,
    }
    token = _make_token(payload)
    result = jwt_utils.verify_access_token(token)
    assert result is not None
    assert result['uuid'] == 'user-abc'
    assert result['username'] == 'tester'
    assert result['role'] == 'PLAYER'
    assert result['source'] == 'jwt'

def test_admin_jwt_role():
    payload = {
        'sub': 'admin-001',
        'username': 'admin',
        'role': 'ADMIN',
        'type': 'access',
        'exp': int(time.time()) + 3600,
    }
    token = _make_token(payload)
    result = jwt_utils.verify_access_token(token)
    assert result['role'] == 'ADMIN'


# ── expired / invalid ─────────────────────────────────────────────────────────

def test_expired_jwt_returns_none():
    payload = {
        'sub': 'user-abc',
        'type': 'access',
        'exp': int(time.time()) - 10,
    }
    token = _make_token(payload)
    assert jwt_utils.verify_access_token(token) is None

def test_wrong_type_returns_none():
    payload = {
        'sub': 'user-abc',
        'type': 'refresh',
        'exp': int(time.time()) + 3600,
    }
    token = _make_token(payload)
    assert jwt_utils.verify_access_token(token) is None

def test_wrong_signature_returns_none():
    payload = {
        'sub': 'user-abc',
        'type': 'access',
        'exp': int(time.time()) + 3600,
    }
    token = _make_token(payload, secret='WrongSecret!!!!!!!!!!!!!!!!!!!!!!!!!!')
    assert jwt_utils.verify_access_token(token) is None

def test_malformed_token_returns_none():
    assert jwt_utils.verify_access_token('not.a.valid') is None

def test_empty_token_returns_none():
    assert jwt_utils.verify_access_token('') is None
    assert jwt_utils.verify_access_token(None) is None

def test_two_parts_token_returns_none():
    assert jwt_utils.verify_access_token('aaa.bbb') is None
