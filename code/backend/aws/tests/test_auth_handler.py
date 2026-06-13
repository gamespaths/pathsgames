"""
Unit tests for auth/handler.py.
db_utils functions are patched so no real DynamoDB calls are made.
"""
import json
import os
import pytest
from unittest.mock import patch, MagicMock
from helpers import make_event, admin_event

# ── helpers ───────────────────────────────────────────────────────────────────

def _body(result):
    return json.loads(result['body'])


ADMIN_USER = {
    'PK': 'USER#admin-uuid-001',
    'SK': 'METADATA',
    'uuid': 'admin-uuid-001',
    'username': 'admin',
    'role': 'ADMIN',
    'state': 6,
    'is_guest': True,
    'guest_token': 'gt-admin',
    'guest_expires_at': 9_999_999_999_000,
    'ts_registration': 1_700_000_000_000,
}

PLAYER_USER = {
    'PK': 'USER#player-uuid-002',
    'SK': 'METADATA',
    'uuid': 'player-uuid-002',
    'username': 'player',
    'role': 'PLAYER',
    'state': 6,
    'is_guest': True,
    'guest_token': 'gt-player',
    'guest_expires_at': 9_999_999_999_000,
    'ts_registration': 1_700_000_000_000,
}


# ── routing ───────────────────────────────────────────────────────────────────

def test_unknown_route_returns_404():
    from auth.handler import lambda_handler
    event = make_event('GET', '/api/auth/unknown-route')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


# ── create_guest ──────────────────────────────────────────────────────────────

def test_create_guest_returns_201():
    with patch('auth.handler.db_utils.put_item', return_value=True):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/guest')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201

def test_create_guest_body_has_access_token():
    with patch('auth.handler.db_utils.put_item', return_value=True):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/guest')
        result = lambda_handler(event, {})
    body = _body(result)
    assert 'accessToken' in body
    assert body['accessToken'].startswith('MOCK_ACCESS_')
    assert 'userUuid' in body
    assert 'username' in body

def test_create_guest_sets_cookies():
    with patch('auth.handler.db_utils.put_item', return_value=True):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/guest')
        result = lambda_handler(event, {})
    assert 'cookies' in result
    cookie_str = ' '.join(result['cookies'])
    assert 'pathsgames.refreshToken' in cookie_str
    assert 'pathsgames.guestcookie' in cookie_str
    # Cross-origin from http://localhost:5174 requires SameSite=None; Secure
    # otherwise Chrome drops the cookies. See lambda/auth/handler.py
    # docstring for the rationale.
    assert 'SameSite=None' in cookie_str
    assert 'Secure' in cookie_str
    assert 'SameSite=Lax' not in cookie_str


def test_create_guest_with_test_marker_uses_marker_prefix():
    with patch('auth.handler.db_utils.put_item', return_value=True), \
         patch.dict(os.environ, {'ENV': 'dev'}):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/guest', headers={'x-test-marker': 'robottest'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    assert _body(result)['username'].startswith('robottest_')


def test_create_guest_ignores_test_marker_when_not_dev():
    with patch('auth.handler.db_utils.put_item', return_value=True), \
         patch.dict(os.environ, {'ENV': 'prod'}):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/guest', headers={'x-test-marker': 'robottest'})
        result = lambda_handler(event, {})
    assert _body(result)['username'].startswith('guest_')


# ── resume_guest ──────────────────────────────────────────────────────────────

def test_resume_guest_missing_cookie_returns_400():
    from auth.handler import lambda_handler
    event = make_event('POST', '/api/auth/guest/resume')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'MISSING_GUEST_COOKIE'

def test_resume_guest_invalid_cookie_returns_401():
    with patch('auth.handler.db_utils.query_gsi', return_value=[]):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/guest/resume',
                           cookies=['pathsgames.guestcookie=invalid-token'])
        result = lambda_handler(event, {})
    assert result['statusCode'] == 401

def test_resume_guest_valid_cookie_returns_200():
    with patch('auth.handler.db_utils.query_gsi', return_value=[PLAYER_USER]), \
         patch('auth.handler.db_utils.update_ts_last_access', return_value=True):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/guest/resume',
                           cookies=['pathsgames.guestcookie=gt-player'])
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['userUuid'] == 'player-uuid-002'


# ── get_me ────────────────────────────────────────────────────────────────────

def test_get_me_without_token_returns_401():
    from auth.handler import lambda_handler
    event = make_event('GET', '/api/auth/me')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401

def test_get_me_with_mock_token_returns_200():
    with patch('auth.handler.db_utils.get_item', return_value=PLAYER_USER):
        from auth.handler import lambda_handler
        event = make_event('GET', '/api/auth/me',
                           headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-002'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['userUuid'] == 'player-uuid-002'
    assert body['role'] == 'PLAYER'

def test_get_me_mock_token_user_not_found_returns_401():
    with patch('auth.handler.db_utils.get_item', return_value=None):
        from auth.handler import lambda_handler
        event = make_event('GET', '/api/auth/me',
                           headers={'Authorization': 'Bearer MOCK_ACCESS_nobody'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 401


# ── logout ────────────────────────────────────────────────────────────────────

def test_logout_without_token_returns_401():
    from auth.handler import lambda_handler
    event = make_event('POST', '/api/auth/logout')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401

def test_logout_clears_cookies():
    with patch('auth.handler.db_utils.get_item', return_value=dict(PLAYER_USER)), \
         patch('auth.handler.db_utils.put_item', return_value=True):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/logout',
                           headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-002'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    cookie_str = ' '.join(result['cookies'])
    assert 'Max-Age=0' in cookie_str


# ── refresh_token ─────────────────────────────────────────────────────────────

def test_refresh_token_invalid_returns_401():
    from auth.handler import lambda_handler
    event = make_event('POST', '/api/auth/refresh',
                       cookies=['pathsgames.refreshToken=BAD_TOKEN'])
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401

def test_refresh_token_valid_returns_200():
    with patch('auth.handler.db_utils.get_item', return_value=dict(PLAYER_USER)), \
         patch('auth.handler.db_utils.put_item', return_value=True):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/refresh',
                           cookies=['pathsgames.refreshToken=MOCK_REFRESH_player-uuid-002'])
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['accessToken'].startswith('MOCK_ACCESS_')


def test_refresh_token_stale_version_revoked_returns_401():
    # The user's current token_version (5) differs from the token's (0) → revoked.
    user = dict(PLAYER_USER, token_version=5)
    with patch('auth.handler.db_utils.get_item', return_value=user), \
         patch('auth.handler.db_utils.put_item', return_value=True):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/refresh',
                           cookies=['pathsgames.refreshToken=MOCK_REFRESH_player-uuid-002.0'])
        result = lambda_handler(event, {})
    assert result['statusCode'] == 401


def test_refresh_token_matching_version_returns_200():
    user = dict(PLAYER_USER, token_version=3)
    with patch('auth.handler.db_utils.get_item', return_value=user), \
         patch('auth.handler.db_utils.put_item', return_value=True):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/refresh',
                           cookies=['pathsgames.refreshToken=MOCK_REFRESH_player-uuid-002.3'])
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200


def test_refresh_rotation_bumps_token_version():
    user = dict(PLAYER_USER, token_version=0)
    captured = {}
    def _capture(item):
        captured.update(item)
        return True
    with patch('auth.handler.db_utils.get_item', return_value=user), \
         patch('auth.handler.db_utils.put_item', side_effect=_capture):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/refresh',
                           cookies=['pathsgames.refreshToken=MOCK_REFRESH_player-uuid-002.0'])
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert captured.get('token_version') == 1


def test_logout_bumps_token_version():
    user = dict(PLAYER_USER, token_version=2)
    captured = {}
    with patch('auth.handler.db_utils.get_item', return_value=user), \
         patch('auth.handler.db_utils.put_item', side_effect=lambda i: captured.update(i) or True):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/logout',
                           headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-002'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert captured.get('token_version') == 3


# ── admin: list_guests ────────────────────────────────────────────────────────

def test_list_guests_requires_admin():
    from auth.handler import lambda_handler
    event = make_event('GET', '/api/admin/guests')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401

def test_list_guests_player_forbidden():
    with patch('auth.handler.db_utils.get_item', return_value=PLAYER_USER):
        from auth.handler import lambda_handler
        event = make_event('GET', '/api/admin/guests',
                           headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-002'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 403

def test_list_guests_admin_returns_200():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.scan_filter', return_value=[PLAYER_USER]):
        from auth.handler import lambda_handler
        event = admin_event('GET', '/api/admin/guests')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert isinstance(body, list)
    assert len(body) == 1


# ── admin: delete_guest ───────────────────────────────────────────────────────

def test_delete_guest_not_found_returns_404():
    with patch('auth.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]):
        from auth.handler import lambda_handler
        event = admin_event('DELETE', '/api/admin/guests/no-such-user')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_delete_guest_success_returns_200():
    with patch('auth.handler.db_utils.get_item', side_effect=[ADMIN_USER, PLAYER_USER]), \
         patch('auth.handler.db_utils.delete_item', return_value=True):
        from auth.handler import lambda_handler
        event = admin_event('DELETE', '/api/admin/guests/player-uuid-002')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['status'] == 'DELETED'


# ── admin: guest_stats ────────────────────────────────────────────────────────

def test_guest_stats_returns_counts():
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.scan_filter', return_value=[PLAYER_USER, ADMIN_USER]):
        from auth.handler import lambda_handler
        event = admin_event('GET', '/api/admin/guests/stats')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert 'totalGuests' in body
    assert body['totalGuests'] == 2


# ── ALLOW_MOCK_ACCESS=false: real JWTs emitted ────────────────────────────────

def test_create_guest_real_jwt_when_mock_disabled():
    from common import jwt_utils as ju
    with patch('auth.handler.db_utils.put_item', return_value=True), \
         patch.object(ju, 'ALLOW_MOCK_ACCESS', False):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/guest')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    body = _body(result)
    token = body['accessToken']
    assert not token.startswith('MOCK_ACCESS_')
    assert len(token.split('.')) == 3   # valid JWT format
    claims = ju.verify_access_token(token)
    assert claims is not None
    assert claims['source'] == 'jwt'

def test_refresh_token_real_jwt_when_mock_disabled():
    from common import jwt_utils as ju
    refresh_tok = ju.generate_refresh_token('player-uuid-002')
    with patch('auth.handler.db_utils.get_item', return_value=dict(PLAYER_USER)), \
         patch('auth.handler.db_utils.put_item', return_value=True), \
         patch.object(ju, 'ALLOW_MOCK_ACCESS', False):
        from auth.handler import lambda_handler
        event = make_event('POST', '/api/auth/refresh',
                           cookies=[f'pathsgames.refreshToken={refresh_tok}'])
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    token = _body(result)['accessToken']
    assert not token.startswith('MOCK_ACCESS_')
    assert ju.verify_access_token(token) is not None
