"""Coverage for auth/handler.py pure helpers and the JWT branch of
_require_auth / the admin IP whitelist guard."""
import os
from unittest.mock import patch

from helpers import make_event


def test_normalize_path_strips_stage_prefix():
    from auth.handler import _normalize_path
    assert _normalize_path('/api/auth/guest') == '/api/auth/guest'
    assert _normalize_path('/dev/api/auth/guest') == '/api/auth/guest'
    assert _normalize_path('no-api-here') == 'no-api-here'


def test_get_source_ip_reads_context_and_forwarded_for():
    from auth.handler import _get_source_ip
    ev = {'requestContext': {'http': {'sourceIp': '1.2.3.4'}}}
    assert _get_source_ip(ev) == '1.2.3.4'
    ev2 = {'headers': {'x-forwarded-for': '9.9.9.9, 1.1.1.1'}}
    assert _get_source_ip(ev2) == '9.9.9.9'


def test_check_admin_ip_whitelist_branches():
    from auth.handler import _check_admin_ip
    ev = {'requestContext': {'http': {'sourceIp': '5.5.5.5'}}}
    # no whitelist configured → allowed
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': ''}, clear=False):
        assert _check_admin_ip(ev) is None
    # whitelisted ip → allowed
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': '5.5.5.5'}, clear=False):
        assert _check_admin_ip(ev) is None
    # ip not in whitelist → 403
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': '1.1.1.1'}, clear=False):
        err = _check_admin_ip(ev)
        assert err is not None and err['statusCode'] == 403


def test_require_auth_jwt_source_uses_db_then_synthetic():
    from auth import handler
    ev = make_event('GET', '/x', headers={'Authorization': 'Bearer realjwt'})
    claims = {'uuid': 'u-jwt', 'source': 'jwt', 'username': 'bob', 'role': 'ADMIN'}
    with patch('auth.handler.jwt_utils.verify_access_token', return_value=claims), \
         patch('auth.handler.db_utils.get_item', return_value={'uuid': 'u-jwt', 'role': 'ADMIN'}):
        user, err = handler._require_auth(ev)
    assert err is None and user['uuid'] == 'u-jwt'

    # not in DB → synthetic dict built from claims
    with patch('auth.handler.jwt_utils.verify_access_token', return_value=claims), \
         patch('auth.handler.db_utils.get_item', return_value=None):
        user2, err2 = handler._require_auth(ev)
    assert err2 is None and user2['username'] == 'bob' and user2['role'] == 'ADMIN'


def test_require_auth_mock_token_user_not_found():
    from auth import handler
    ev = make_event('GET', '/x', headers={'Authorization': 'Bearer MOCK_ACCESS_ghost'})
    with patch('auth.handler.db_utils.get_item', return_value=None):
        user, err = handler._require_auth(ev)
    assert user is None and err['statusCode'] == 401
