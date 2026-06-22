"""Tests for common/http_utils.py — normalize_path, get_source_ip, bearer_token, check_admin_ip."""
import os
from unittest.mock import patch

from common.http_utils import normalize_path, get_source_ip, bearer_token, check_admin_ip


def test_normalize_path_already_api():
    assert normalize_path('/api/stories') == '/api/stories'


def test_normalize_path_strips_stage():
    assert normalize_path('/dev/api/stories') == '/api/stories'
    assert normalize_path('/prod/api/auth/guest') == '/api/auth/guest'


def test_normalize_path_no_api():
    assert normalize_path('no-api-here') == 'no-api-here'


def test_get_source_ip_from_request_context():
    ev = {'requestContext': {'http': {'sourceIp': '1.2.3.4'}}}
    assert get_source_ip(ev) == '1.2.3.4'


def test_get_source_ip_from_forwarded_for():
    ev = {'headers': {'x-forwarded-for': '9.9.9.9, 1.1.1.1'}}
    assert get_source_ip(ev) == '9.9.9.9'


def test_get_source_ip_empty():
    assert get_source_ip({}) == ''


def test_bearer_token_present():
    ev = {'headers': {'authorization': 'Bearer my-token-123'}}
    assert bearer_token(ev) == 'my-token-123'


def test_bearer_token_case_insensitive_header():
    ev = {'headers': {'Authorization': 'Bearer abc'}}
    assert bearer_token(ev) == 'abc'


def test_bearer_token_missing():
    assert bearer_token({}) is None
    assert bearer_token({'headers': {}}) is None


def test_bearer_token_no_bearer_prefix():
    ev = {'headers': {'authorization': 'Basic dXNlcjpwYXNz'}}
    assert bearer_token(ev) is None


def test_check_admin_ip_no_whitelist():
    ev = {'requestContext': {'http': {'sourceIp': '5.5.5.5'}}}
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': ''}, clear=False):
        assert check_admin_ip(ev) is None


def test_check_admin_ip_allowed():
    ev = {'requestContext': {'http': {'sourceIp': '5.5.5.5'}}}
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': '5.5.5.5,6.6.6.6'}, clear=False):
        assert check_admin_ip(ev) is None


def test_check_admin_ip_blocked():
    ev = {'requestContext': {'http': {'sourceIp': '9.9.9.9'}}}
    with patch.dict(os.environ, {'ADMIN_IP_WHITELIST': '1.1.1.1'}, clear=False):
        resp = check_admin_ip(ev)
        assert resp is not None
        assert resp['statusCode'] == 403
