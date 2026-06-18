"""
Unit tests for common/jwt_utils.py — pure functions, no mocking needed.
"""
import base64
import hmac
import hashlib
import json
import time
import os

import pytest
from unittest.mock import patch

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


# ── MOCK tokens (ALLOW_MOCK_ACCESS=true, default) ──────────────────────────────

def test_mock_token_returns_uuid():
    result = jwt_utils.verify_access_token('MOCK_ACCESS_some-uuid-here')
    assert result is not None
    assert result['uuid'] == 'some-uuid-here'
    assert result['source'] == 'mock'

def test_mock_token_role_is_none():
    result = jwt_utils.verify_access_token('MOCK_ACCESS_x')
    assert result['role'] is None
    assert result['username'] is None

def test_mock_token_rejected_when_disabled():
    with patch.object(jwt_utils, 'ALLOW_MOCK_ACCESS', False):
        result = jwt_utils.verify_access_token('MOCK_ACCESS_some-uuid-here')
    assert result is None


# ── generate + verify round-trips ─────────────────────────────────────────────

def test_generate_access_token_is_valid():
    token = jwt_utils.generate_access_token('user-001', 'alice', 'PLAYER')
    result = jwt_utils.verify_access_token(token)
    assert result is not None
    assert result['uuid'] == 'user-001'
    assert result['username'] == 'alice'
    assert result['role'] == 'PLAYER'
    assert result['source'] == 'jwt'

def test_generate_access_token_admin():
    token = jwt_utils.generate_access_token('admin-001', 'admin', 'ADMIN')
    result = jwt_utils.verify_access_token(token)
    assert result['role'] == 'ADMIN'

def test_generate_refresh_token_roundtrip():
    token = jwt_utils.generate_refresh_token('user-002')
    uuid_out = jwt_utils.verify_refresh_token(token)
    assert uuid_out == 'user-002'

def test_verify_refresh_token_expired():
    token = jwt_utils.generate_refresh_token('user-003', exp_seconds=-1)
    assert jwt_utils.verify_refresh_token(token) is None

def test_verify_refresh_token_wrong_type():
    token = jwt_utils.generate_access_token('user-004', 'bob', 'PLAYER')
    assert jwt_utils.verify_refresh_token(token) is None

def test_verify_refresh_token_invalid():
    assert jwt_utils.verify_refresh_token('not.a.token') is None
    assert jwt_utils.verify_refresh_token(None) is None

def test_generate_access_token_rejected_as_refresh():
    token = jwt_utils.generate_access_token('user-005', 'charlie', 'PLAYER')
    assert jwt_utils.verify_refresh_token(token) is None


# ── valid HS256 JWT (externally generated) ────────────────────────────────────

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
