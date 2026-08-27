"""Coverage for auth/handler.py guard branches: the admin-IP whitelist edge cases,
the admin short-circuits on the guest-management endpoints and the refresh-token
rejection paths."""
import json
import os
from unittest.mock import patch

from helpers import make_event


def _body(result):
    return json.loads(result['body'])


def _ip_event(ip='7.7.7.7'):
    return {'requestContext': {'http': {'method': 'GET', 'sourceIp': ip}}, 'headers': {}}


# ── _check_admin_ip ──────────────────────────────────────────────────────────

def test_check_admin_ip_separators_only_whitelist_allows():
    from auth.handler import _check_admin_ip
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': ' , ,  '}, clear=False):
        assert _check_admin_ip(_ip_event()) is None


def test_check_admin_ip_rejects_unlisted():
    from auth.handler import _check_admin_ip
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': '1.1.1.1'}, clear=False):
        err = _check_admin_ip(_ip_event())
        assert err['statusCode'] == 403


def test_require_admin_short_circuits_on_ip():
    from auth import handler
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': '1.1.1.1'}, clear=False):
        user, err = handler._require_admin(_ip_event())
    assert user is None and err['statusCode'] == 403


# ── admin guest endpoints all bail out when _require_admin fails ─────────────

def test_admin_guest_endpoints_propagate_the_guard_error():
    from auth import handler
    forbidden = handler._err(403, 'FORBIDDEN', 'ADMIN role required')
    calls = [
        (handler.guest_stats, ()),
        (handler.cleanup_expired, ()),
        (handler.get_guest_by_uuid, ('g1',)),
        (handler.delete_guest, ('g1',)),
    ]
    with patch.object(handler, '_require_admin', return_value=(None, forbidden)):
        for fn, args in calls:
            result = fn(make_event('GET', '/x'), *args)
            assert result['statusCode'] == 403, fn.__name__


def test_logout_all_propagates_the_auth_error():
    from auth import handler
    unauth = handler._err(401, 'UNAUTHORIZED', 'nope')
    with patch.object(handler, '_require_auth', return_value=(None, unauth)):
        result = handler.logout_all(make_event('POST', '/x'))
    assert result['statusCode'] == 401


# ── refresh_token rejection paths ────────────────────────────────────────────

def _refresh_event(cookie):
    return make_event('POST', '/api/auth/refresh', cookies=[cookie] if cookie else None)


def test_refresh_rejects_non_numeric_mock_version():
    from auth import handler
    with patch.object(handler.jwt_utils, 'ALLOW_MOCK_ACCESS', True):
        result = handler.refresh_token(
            _refresh_event('pathsgames.refreshToken=MOCK_REFRESH_u1.notanint'))
    assert result['statusCode'] == 401
    assert _body(result)['error'] == 'INVALID_REFRESH_TOKEN'


def test_refresh_rejects_missing_cookie():
    from auth import handler
    with patch.object(handler.jwt_utils, 'ALLOW_MOCK_ACCESS', True):
        result = handler.refresh_token(_refresh_event(None))
    assert result['statusCode'] == 401


def test_refresh_rejects_undecodable_real_jwt():
    from auth import handler
    with patch.object(handler.jwt_utils, 'ALLOW_MOCK_ACCESS', False), \
         patch.object(handler.jwt_utils, 'decode_refresh_token', return_value=None):
        result = handler.refresh_token(_refresh_event('pathsgames.refreshToken=garbage'))
    assert result['statusCode'] == 401
    assert _body(result)['error'] == 'INVALID_REFRESH_TOKEN'


def test_refresh_rejects_unknown_user():
    from auth import handler
    with patch.object(handler.jwt_utils, 'ALLOW_MOCK_ACCESS', True), \
         patch('auth.handler.db_utils.get_item', return_value=None):
        result = handler.refresh_token(
            _refresh_event('pathsgames.refreshToken=MOCK_REFRESH_ghost.0'))
    assert result['statusCode'] == 401
    assert _body(result)['error'] == 'INVALID_REFRESH_TOKEN'
