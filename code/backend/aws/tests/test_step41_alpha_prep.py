"""v0.41.0 — Step 41 alpha preparation on AWS: security headers, the allow-list rule with
ADMIN_IP_EMPTY_MEANS, the JWT/env guards, the per-guest bucket, the aged-guest header and the
guest cleanup (expired fix, withoutMatches, the scheduled Lambda)."""
import json
import os
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from helpers import admin_event, make_event

PRIVATE = 'a-private-prod-secret-of-at-least-32-chars'
ADMIN_USER = {'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001',
              'username': 'admin', 'role': 'ADMIN', 'state': 6}
DAY_MS = 86_400_000


def _body(result):
    return json.loads(result['body'])


def _guest_row(uuid, seen_ms, expires=9_999_999_999_000):
    return {'PK': f'USER#{uuid}', 'SK': 'METADATA', 'GSI2_PK': 'GUEST_LIST', 'GSI2_SK': f'USER#{uuid}',
            'summary': {'uuid': uuid, 'ts_last_access': seen_ms, 'guest_expires_at': expires}}


class _Counter:
    """update_item ADDs a counter per key, like DynamoDB."""

    def __init__(self):
        self.counts, self.calls = {}, []

    def update_item(self, **kwargs):
        self.calls.append(kwargs)
        key = (kwargs['Key']['PK'], kwargs['Key']['SK'])
        self.counts[key] = self.counts.get(key, 0) + 1
        return {'Attributes': {'cnt': self.counts[key]}}


# ── response.finalize ─────────────────────────────────────────────────────────

def test_finalize_adds_security_headers_and_no_store_without_touching_headers():
    from common import response
    before = dict(response.HEADERS)
    local = response.finalize({'statusCode': 200, 'headers': {'Content-Type': 'text/plain'}}, '/api/stories')
    assert local['headers']['Content-Type'] == 'text/plain'
    assert local['headers']['X-Frame-Options'] == 'DENY'
    assert local['headers']['Content-Security-Policy'] == "default-src 'none'; frame-ancestors 'none'"
    assert 'Cache-Control' not in local['headers']
    auth = response.finalize(response.ok({}), '/api/auth/guest')
    admin = response.finalize(response.err(403, 'X', 'y'), '/api/admin/guests')
    assert auth['headers']['Cache-Control'] == 'no-store' == admin['headers']['Cache-Control']
    bare = response.finalize({'statusCode': 204}, '/api/admin')
    assert bare['headers']['Cache-Control'] == 'no-store'
    assert response.HEADERS == before, 'the shared dict must never be mutated'
    assert response.finalize({'isAuthorized': True}, '/api/admin/x') == {'isAuthorized': True}
    assert response.finalize(None, '/api/auth/x') is None
    assert not response.is_no_store_path('/api/authors') and not response.is_no_store_path(None)


# ── allow-list: one rule, ADMIN_IP_EMPTY_MEANS ────────────────────────────────

@pytest.mark.parametrize('whitelist,means,ip,allowed', [
    ('', None, '9.9.9.9', False),
    ('', 'nobody', '9.9.9.9', False),
    (' , ', 'NOBODY', '9.9.9.9', False),
    ('', 'everybody', '9.9.9.9', True),
    ('', ' Everybody ', '9.9.9.9', True),
    ('1.2.3.4, 5.6.7.8', 'nobody', '5.6.7.8', True),
    ('1.2.3.4', 'everybody', '9.9.9.9', False),
])
def test_admin_ip_rule(monkeypatch, whitelist, means, ip, allowed):
    from common import http_utils
    from authorizer.handler import lambda_handler
    monkeypatch.setenv('ADMIN_IP_WHITELIST', whitelist)
    if means is None:
        monkeypatch.delenv('ADMIN_IP_EMPTY_MEANS', raising=False)
    else:
        monkeypatch.setenv('ADMIN_IP_EMPTY_MEANS', means)
    event = {'requestContext': {'http': {'sourceIp': ip}}}
    assert http_utils.admin_ip_allowed(ip) is allowed
    assert lambda_handler(event, {}) == {'isAuthorized': allowed}
    result = http_utils.check_admin_ip(event)
    assert (result is None) is allowed
    if not allowed:
        assert result['statusCode'] == 403 and ip in _body(result)['message']


def test_check_admin_ip_answers_in_the_callers_error_shape(monkeypatch):
    from common import http_utils
    monkeypatch.setenv('ADMIN_IP_WHITELIST', '')
    monkeypatch.setenv('ADMIN_IP_EMPTY_MEANS', 'nobody')
    shaped = http_utils.check_admin_ip({'requestContext': {'http': {'sourceIp': '1.1.1.1'}}},
                                       lambda status, code, msg: ('shaped', status, code))
    assert shaped == ('shaped', 403, 'FORBIDDEN')


@pytest.mark.parametrize('module,path', [
    ('auth.handler', '/api/admin/guests'),
    ('story.handler', '/api/admin/stories'),
    ('match.handler', '/api/admin/matches'),
])
def test_every_admin_handler_applies_nobody(monkeypatch, module, path):
    import importlib
    handler = importlib.import_module(module)
    monkeypatch.setenv('ADMIN_IP_WHITELIST', '')
    monkeypatch.setenv('ADMIN_IP_EMPTY_MEANS', 'nobody')
    event = admin_event('GET', path)
    event['requestContext']['http']['sourceIp'] = '8.8.8.8'
    with patch('common.db_utils.get_item', return_value=ADMIN_USER):
        result = handler.lambda_handler(event, {})
    assert result['statusCode'] == 403
    assert result['headers']['Cache-Control'] == 'no-store'
    monkeypatch.setenv('ADMIN_IP_WHITELIST', '8.8.8.8')
    assert handler._check_admin_ip(event) is None


# ── env rule and the JWT guard ────────────────────────────────────────────────

def test_env_rule(monkeypatch):
    from common import test_data_ttl
    for env in ('dev', 'development', 'test', ' TEST '):
        assert test_data_ttl.is_test_env(env)
    for env in ('prod', 'alpha', 'beta', 'production', ''):
        assert not test_data_ttl.is_test_env(env)
    monkeypatch.delenv('ENV', raising=False)
    assert test_data_ttl.is_test_env()
    monkeypatch.setenv('ENV', 'alpha')
    assert not test_data_ttl.is_test_env()


def test_misconfigured_only_outside_dev_test_with_the_committed_secret(monkeypatch):
    from common import jwt_utils
    monkeypatch.setenv('ENV', 'test')
    assert not jwt_utils.misconfigured()
    monkeypatch.setenv('ENV', 'prod')
    assert jwt_utils.misconfigured()
    monkeypatch.setattr(jwt_utils, 'JWT_SECRET', PRIVATE)
    assert not jwt_utils.misconfigured()
    monkeypatch.setattr(jwt_utils, 'JWT_SECRET', ' ')
    assert jwt_utils.misconfigured()
    resp = jwt_utils.misconfigured_response()
    assert resp['statusCode'] == 500 and _body(resp)['error'] == 'MISCONFIGURED'
    assert jwt_utils.DEV_JWT_SECRET not in resp['body']


@pytest.mark.parametrize('module,path', [
    ('auth.handler', '/api/auth/guest'),
    ('story.handler', '/api/stories'),
    ('match.handler', '/api/matches'),
    ('seed.handler', '/api/dev/seed'),
])
def test_handlers_answer_500_when_misconfigured(monkeypatch, module, path):
    import importlib
    handler = importlib.import_module(module)
    monkeypatch.setenv('ENV', 'beta')
    result = handler.lambda_handler(make_event('POST', path), {})
    assert result['statusCode'] == 500 and _body(result)['error'] == 'MISCONFIGURED'
    assert result['headers']['X-Content-Type-Options'] == 'nosniff'


def test_content_and_echo_leave_through_finalize():
    from content.handler import lambda_handler as content
    from echo.handler import lambda_handler as echo
    assert content(make_event('POST', '/api/content/s/cards/c'), {})['headers']['X-Frame-Options'] == 'DENY'
    answer = echo(make_event('GET', '/api/echo/status'), {})
    assert answer['headers']['Strict-Transport-Security'] == 'max-age=31536000'
    assert 'Cache-Control' not in answer['headers']


def test_seed_accepts_development_as_dev(monkeypatch):
    from seed import handler
    monkeypatch.setenv('ENV', 'development')
    with patch.object(handler, '_handle_cleanup', return_value={'statusCode': 200, 'headers': {}}):
        assert handler.lambda_handler(make_event('POST', '/api/dev/cleanup'), {})['statusCode'] == 200


def test_turnstile_bypass_only_on_dev_test():
    import match.handler as h
    with patch.object(h, '_TURNSTILE_SECRET', 'real'), patch.object(h, '_TURNSTILE_BYPASS_TOKEN', 'BYPASS'), \
         patch('match.handler.urllib.request.urlopen', side_effect=OSError('offline')):
        for env in ('alpha', 'beta', 'prod'):
            with patch.object(h, '_ENV', env):
                assert not h._verify_turnstile('BYPASS')
        with patch.object(h, '_ENV', 'development'):
            assert h._verify_turnstile('BYPASS')


# ── limits ────────────────────────────────────────────────────────────────────

def test_limit_defaults(monkeypatch):
    from common import security_utils
    for key in ('RATE_LIMIT_GUEST_PER_IP', 'RATE_LIMIT_MATCH_PER_IP', 'RATE_LIMIT_MATCH_PER_GUEST',
                'RATE_LIMIT_MATCH_PER_GUEST_WINDOW_SECONDS'):
        monkeypatch.delenv(key, raising=False)
    assert (security_utils.guest_per_ip(), security_utils.match_per_ip()) == (20, 20)
    assert security_utils.match_per_guest() == 10
    assert security_utils.match_per_guest_window() == 86400
    monkeypatch.setenv('RATE_LIMIT_MATCH_PER_GUEST_WINDOW_SECONDS', '0')
    assert security_utils.match_per_guest_window() == 1


def test_rate_limit_window_override(monkeypatch):
    from common import db_utils, security_utils
    table = _Counter()
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    v = security_utils.rate_limit('match-guest', 'user-1', 1, now=50_000, window=86400)
    assert v.allowed and v.retry_after_seconds == 86400 - 50_000
    call = table.calls[-1]
    assert call['Key'] == {'PK': 'RATELIMIT#match-guest#user-1', 'SK': 'WINDOW#0'}
    assert call['ExpressionAttributeValues'][':ttl'] == 2 * 86400


def test_create_match_per_guest_bucket(monkeypatch):
    import match.handler as h
    from common import db_utils
    table = _Counter()
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    monkeypatch.setenv('RATE_LIMIT_MATCH_PER_GUEST', '1')
    user = {'uuid': 'player-1', 'role': 'PLAYER', 'state': 6}
    assert h._create_match(user, {})['statusCode'] == 400          # past the gate
    refused = h._create_match(user, {})
    assert refused['statusCode'] == 429 and refused['headers']['Retry-After']
    assert _body(refused)['message'].startswith('Too many matches created by this player')
    assert table.calls[-1]['Key']['PK'] == 'RATELIMIT#match-guest#player-1'
    monkeypatch.setenv('RATE_LIMIT_MATCH_PER_GUEST', '0')
    assert h._create_match(user, {})['statusCode'] == 400


# ── aged guests ───────────────────────────────────────────────────────────────

def _created_row(env, headers, now_ms=10_000 * DAY_MS):
    from auth import handler
    with patch('auth.handler.db_utils.put_item', return_value=True) as put, \
         patch.object(handler, '_now_ms', return_value=now_ms), \
         patch('common.jwt_utils.JWT_SECRET', PRIVATE), \
         patch.dict(os.environ, {'ENV': env}):
        result = handler.lambda_handler(make_event('POST', '/api/auth/guest', headers=headers), {})
    assert result['statusCode'] == 201
    assert result['headers']['Cache-Control'] == 'no-store'
    return put.call_args[0][0]


def test_aged_guest_on_the_test_stack():
    now = 10_000 * DAY_MS
    row = _created_row('test', {'x-test-marker': 'robottest', 'x-test-guest-age-days': '400'}, now)
    born = now - 400 * DAY_MS
    assert row['ts_registration'] == born == row['ts_last_access'] == row['summary']['ts_last_access']
    assert row['guest_expires_at'] == born + 180 * DAY_MS
    assert row['username'].startswith('robottest_')


@pytest.mark.parametrize('env,headers', [
    ('test', {'x-test-guest-age-days': '400'}),
    ('prod', {'x-test-marker': 'robottest', 'x-test-guest-age-days': '400'}),
    ('test', {'x-test-marker': 'robottest', 'x-test-guest-age-days': '0'}),
    ('test', {'x-test-marker': 'robottest', 'x-test-guest-age-days': '3651'}),
    ('test', {'x-test-marker': 'robottest', 'x-test-guest-age-days': 'old'}),
    ('test', {'x-test-marker': 'robottest'}),
])
def test_age_ignored_when_not_allowed(env, headers):
    now = 10_000 * DAY_MS
    assert _created_row(env, headers, now)['ts_registration'] == now


# ── the expired fix and the match-less purge ──────────────────────────────────

def test_has_match_reads_one_gsi1_item(monkeypatch):
    from auth import handler
    from common import db_utils
    table = MagicMock()
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    table.query.return_value = {'Items': [{'uuid': 'm-1'}]}
    assert handler._has_match('g1')
    assert table.query.call_args.kwargs['IndexName'] == 'GSI1'
    assert table.query.call_args.kwargs['Limit'] == 1
    table.query.return_value = {'Items': []}
    assert not handler._has_match('g1')
    table.query.side_effect = ClientError({'Error': {'Code': 'Boom', 'Message': 'x'}}, 'Query')
    assert handler._has_match('g1'), 'in doubt the guest is kept'
    assert not handler._has_match(None)


def test_cleanup_expired_keeps_the_guest_that_owns_a_match():
    from auth import handler
    guests = [_guest_row('with-match', 1, expires=1), _guest_row('free', 1, expires=1)]
    deleted = []
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_gsi', return_value=guests), \
         patch.object(handler, '_has_match', side_effect=lambda uuid: uuid == 'with-match'), \
         patch('auth.handler.db_utils.delete_item', side_effect=lambda pk, sk: deleted.append(pk)):
        result = handler.lambda_handler(admin_event('DELETE', '/api/admin/guests/expired'), {})
    assert result['statusCode'] == 200 and _body(result)['deletedCount'] == 1
    assert deleted == ['USER#free']


def _pages(*pages):
    """query_index_page stand-in: one page per call, the last without a next key."""
    calls = []

    def page(index, pk_name, pk_val, limit=50, start_key=None, ascending=False, **_):
        assert (index, pk_name, pk_val, ascending) == ('GSI2', 'GSI2_PK', 'GUEST_LIST', True)
        n = len(calls)
        calls.append(start_key)
        return list(pages[n]), ({'k': n + 1} if n + 1 < len(pages) else None)
    return page, calls


def test_without_matches_preview_and_delete_page_through_the_guest_list(monkeypatch):
    from auth import handler
    monkeypatch.setenv('GUEST_CLEANUP_MAX_PER_RUN', '500')
    old = 1
    page, calls = _pages([_guest_row('a', old), _guest_row('recent', 9_999_999_999_000)],
                         [_guest_row('b', old), _guest_row('owner', old)])
    deleted = []
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_index_page', side_effect=page), \
         patch.object(handler, '_has_match', side_effect=lambda uuid: uuid == 'owner'), \
         patch('auth.handler.db_utils.delete_item', side_effect=lambda pk, sk: deleted.append(pk)), \
         patch('auth.handler.db_utils.delete_all_by_pk') as delete_match:
        result = handler.lambda_handler(admin_event(
            'DELETE', '/api/admin/guests/stale', qs={'olderThanDays': '365', 'withoutMatches': 'true'}), {})
    assert result['statusCode'] == 200
    assert _body(result) == {'guests': 2, 'matches': 0, 'status': 'CLEANUP_COMPLETE'}
    assert deleted == ['USER#a', 'USER#b'] and calls == [None, {'k': 1}]
    delete_match.assert_not_called()

    page, _ = _pages([_guest_row('a', old), _guest_row('b', old)])
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_index_page', side_effect=page), \
         patch.object(handler, '_has_match', return_value=False):
        monkeypatch.setenv('GUEST_CLEANUP_MAX_PER_RUN', '1')
        preview = handler.lambda_handler(admin_event(
            'GET', '/api/admin/guests/stale', qs={'olderThanDays': '365', 'withoutMatches': 'true'}), {})
    assert _body(preview) == {'guests': 1, 'matches': 0}


def test_without_matches_false_and_bad_values(monkeypatch):
    from auth import handler
    with patch('auth.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('auth.handler.db_utils.query_gsi', return_value=[]):
        for method in ('GET', 'DELETE'):
            bad = handler.lambda_handler(admin_event(
                method, '/api/admin/guests/stale', qs={'olderThanDays': '1', 'withoutMatches': 'maybe'}), {})
            assert bad['statusCode'] == 400
            assert _body(bad)['message'] == 'withoutMatches must be true or false'
        today = handler.lambda_handler(admin_event(
            'GET', '/api/admin/guests/stale', qs={'olderThanDays': '1', 'withoutMatches': 'false'}), {})
    assert _body(today) == {'guests': 0, 'matches': 0}


def test_idle_guests_stop_at_the_deadline(monkeypatch):
    from auth import handler
    monkeypatch.delenv('GUEST_CLEANUP_MAX_PER_RUN', raising=False)
    with patch('auth.handler.db_utils.query_index_page') as page:
        assert handler._idle_guests(10, 5, lambda: True) == []
    page.assert_not_called()
    assert handler._max_per_run() == 500


def test_scheduled_cleanup(monkeypatch):
    from auth import handler
    monkeypatch.setenv('GUEST_CLEANUP_ENABLED', 'false')
    assert handler.scheduled_cleanup({}, None) == {'status': 'DISABLED', 'guests': 0}
    monkeypatch.setenv('GUEST_CLEANUP_ENABLED', 'true')
    monkeypatch.setenv('GUEST_CLEANUP_AGE_DAYS', '-1')
    assert handler.scheduled_cleanup({}, None)['status'] == 'DISABLED'
    monkeypatch.setenv('GUEST_CLEANUP_AGE_DAYS', 'junk')
    seen = {}

    def cleanup(bound, cap, deadline):
        seen.update(bound=bound, cap=cap, stop=deadline())
        return 3
    monkeypatch.setattr(handler, '_cleanup_idle_guests', cleanup)
    context = MagicMock()
    context.get_remaining_time_in_millis.return_value = 200_000
    assert handler.scheduled_cleanup({}, context) == {'status': 'CLEANUP_COMPLETE', 'guests': 3}
    assert seen['cap'] == 500 and seen['stop'] is False
    assert handler._now_ms() - seen['bound'] >= 60 * DAY_MS - 1000
    context.get_remaining_time_in_millis.return_value = 5_000
    handler.scheduled_cleanup({}, context)
    assert seen['stop'] is True
    assert handler.scheduled_cleanup({}, object())['guests'] == 3
    assert seen['stop'] is False
