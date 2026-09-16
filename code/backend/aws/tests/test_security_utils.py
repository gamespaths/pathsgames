"""v0.37.7 — Step 41: the DynamoDB-backed per-IP rate limiter and the stateless CSRF token,
plus their wiring on POST /api/auth/guest, the refresh/resume bodies and POST /api/matches."""
import base64
import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from helpers import make_event

SECRET = 'PathsGamesDevSecret2026_MustBeAtLeast32Chars!'


def _body(result):
    return json.loads(result['body'])


# ── csrf ──────────────────────────────────────────────────────────────────────

def test_csrf_token_matches_the_shared_vector(monkeypatch):
    from common import security_utils, jwt_utils
    monkeypatch.setattr(jwt_utils, 'JWT_SECRET', SECRET)
    monkeypatch.delenv('CSRF_SECRET', raising=False)
    expected = base64.urlsafe_b64encode(
        hmac.new(SECRET.encode(), b'csrf:t', hashlib.sha256).digest()).rstrip(b'=').decode()
    assert security_utils.csrf_token_for('t') == expected
    assert security_utils.csrf_token_for(' t ') == expected
    assert security_utils.csrf_token_for(None) is None
    assert security_utils.csrf_token_for('  ') is None
    assert '=' not in expected


def test_csrf_secret_env_overrides_the_jwt_one(monkeypatch):
    from common import security_utils, jwt_utils
    monkeypatch.setattr(jwt_utils, 'JWT_SECRET', SECRET)
    monkeypatch.setenv('CSRF_SECRET', 'another-secret')
    assert security_utils.csrf_token_for('t') != base64.urlsafe_b64encode(
        hmac.new(SECRET.encode(), b'csrf:t', hashlib.sha256).digest()).rstrip(b'=').decode()
    monkeypatch.setattr(jwt_utils, 'JWT_SECRET', SECRET.encode())
    monkeypatch.delenv('CSRF_SECRET', raising=False)
    assert security_utils.csrf_token_for('t')


def test_csrf_matches_and_header_lookup(monkeypatch):
    from common import security_utils
    token = security_utils.csrf_token_for('eyJ.access')
    assert security_utils.csrf_matches('eyJ.access', token)
    assert security_utils.csrf_matches('eyJ.access', ' ' + token + ' ')
    assert not security_utils.csrf_matches('eyJ.access', token + 'x')
    assert not security_utils.csrf_matches('eyJ.other', token)
    assert not security_utils.csrf_matches('eyJ.access', None)
    assert not security_utils.csrf_matches('eyJ.access', '  ')
    assert not security_utils.csrf_matches(None, token)
    assert security_utils.csrf_header({'headers': {'X-CSRF-Token': 'abc'}}) == 'abc'
    assert security_utils.csrf_header({'headers': None}) is None
    monkeypatch.setenv('CSRF_ENFORCED', 'true')
    assert security_utils.csrf_enforced()
    monkeypatch.setenv('CSRF_ENFORCED', '0')
    assert not security_utils.csrf_enforced()


def test_env_readers(monkeypatch):
    from common import security_utils
    monkeypatch.setenv('RATE_LIMIT_GUEST_PER_IP', '7')
    monkeypatch.setenv('RATE_LIMIT_MATCH_PER_IP', 'junk')
    monkeypatch.setenv('RATE_LIMIT_WINDOW_SECONDS', '0')
    assert security_utils.guest_per_ip() == 7
    assert security_utils.match_per_ip() == 0
    assert security_utils.window_seconds() == 1
    monkeypatch.setenv('RATE_LIMIT_WINDOW_SECONDS', '')
    assert security_utils.window_seconds() == 3600


# ── rate limit ────────────────────────────────────────────────────────────────

class _Counter:
    """A table whose update_item ADDs a counter per key, like DynamoDB does."""

    def __init__(self, fail=False):
        self.counts = {}
        self.calls = []
        self.fail = fail

    def update_item(self, **kwargs):
        if self.fail:
            raise ClientError({'Error': {'Code': 'Boom', 'Message': 'no table'}}, 'UpdateItem')
        self.calls.append(kwargs)
        key = (kwargs['Key']['PK'], kwargs['Key']['SK'])
        self.counts[key] = self.counts.get(key, 0) + 1
        return {'Attributes': {'cnt': self.counts[key]}}


def test_rate_limit_counts_per_window_and_refuses_past_the_limit(monkeypatch):
    from common import security_utils, db_utils
    table = _Counter()
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    monkeypatch.setenv('RATE_LIMIT_WINDOW_SECONDS', '100')
    now = 1_000_050
    for i in range(2):
        v = security_utils.rate_limit('guest', '1.2.3.4', 2, now=now)
        assert v.allowed and v.remaining == 1 - i and v.limit == 2
    refused = security_utils.rate_limit('guest', '1.2.3.4', 2, now=now)
    assert not refused.allowed and refused.remaining == 0
    assert refused.retry_after_seconds == 50           # the window started at 1_000_000
    call = table.calls[-1]
    assert call['Key'] == {'PK': 'RATELIMIT#guest#1.2.3.4', 'SK': 'WINDOW#1000000'}
    assert call['ExpressionAttributeValues'][':ttl'] == 1_000_200
    assert call['ReturnValues'] == 'UPDATED_NEW'
    # the next window starts fresh; another bucket or address never shares the counter
    assert security_utils.rate_limit('guest', '1.2.3.4', 2, now=1_000_100).allowed
    assert security_utils.rate_limit('match', '1.2.3.4', 2, now=now).allowed
    assert security_utils.rate_limit('guest', '5.6.7.8', 2, now=now).allowed


def test_rate_limit_disabled_anonymous_or_offline_never_refuses(monkeypatch):
    from common import security_utils, db_utils
    table = _Counter()
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    assert security_utils.rate_limit('guest', '1.2.3.4', 0).allowed
    assert security_utils.rate_limit('guest', '', 5).allowed
    assert security_utils.rate_limit('guest', None, 5).allowed
    assert table.calls == []
    monkeypatch.setattr(db_utils, '_get_table', lambda: _Counter(fail=True))
    offline = security_utils.rate_limit('guest', '1.2.3.4', 5)
    assert offline.allowed and offline.retry_after_seconds == 0


def test_rate_limited_response_shape():
    from common import security_utils
    resp = security_utils.rate_limited(security_utils.Verdict(False, 3, 0, 42), 'Too many', now_ms=7)
    assert resp['statusCode'] == 429
    assert resp['headers']['Retry-After'] == '42'
    body = json.loads(resp['body'])
    assert body == {'error': 'RATE_LIMITED', 'message': 'Too many, retry in 42 seconds',
                    'retryAfterSeconds': 42, 'timestamp': 7}
    assert json.loads(security_utils.rate_limited(
        security_utils.Verdict(False, 3, 0, 1), 'x')['body'])['timestamp'] > 0


# ── auth handler wiring ───────────────────────────────────────────────────────

def test_guest_creation_carries_csrf_token_and_is_rate_limited(monkeypatch):
    from common import security_utils, db_utils
    from auth.handler import lambda_handler
    table = _Counter()
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    monkeypatch.setenv('RATE_LIMIT_GUEST_PER_IP', '2')
    with patch('auth.handler.db_utils.put_item', return_value=True):
        event = make_event('POST', '/api/auth/guest')
        event['requestContext'] = {'http': {'sourceIp': '9.9.9.9', 'method': 'POST', 'path': '/api/auth/guest'}}
        first = lambda_handler(event, {})
        assert first['statusCode'] == 201
        body = _body(first)
        assert body['csrfToken'] == security_utils.csrf_token_for(body['accessToken'])
        assert lambda_handler(event, {})['statusCode'] == 201
        refused = lambda_handler(event, {})
        assert refused['statusCode'] == 429
        assert refused['headers']['Retry-After']
        assert _body(refused)['error'] == 'RATE_LIMITED'
        # another address is not affected
        event['requestContext']['http']['sourceIp'] = '8.8.8.8'
        assert lambda_handler(event, {})['statusCode'] == 201


def test_guest_creation_unlimited_when_disabled(monkeypatch):
    from auth.handler import lambda_handler
    with patch('auth.handler.db_utils.put_item', return_value=True):
        for _ in range(15):
            assert lambda_handler(make_event('POST', '/api/auth/guest'), {})['statusCode'] == 201


def _guest_row():
    return {'PK': 'USER#u-1', 'SK': 'METADATA', 'uuid': 'u-1', 'username': 'guest_u1',
            'role': 'PLAYER', 'state': 6, 'is_guest': True, 'guest_token': 'g-tok',
            'guest_expires_at': 9_999_999_999_999, 'token_version': 0}


def test_resume_and_refresh_carry_csrf_token():
    from common import security_utils
    from auth.handler import lambda_handler
    with patch('auth.handler.db_utils.query_gsi', return_value=[_guest_row()]), \
         patch('auth.handler.db_utils.update_ts_last_access', return_value=True), \
         patch('auth.handler.db_utils.put_item', return_value=True), \
         patch('auth.handler.db_utils.get_item', return_value=_guest_row()):
        resumed = lambda_handler(make_event('POST', '/api/auth/guest/resume',
                                            cookies=['pathsgames.guestcookie=g-tok']), {})
        assert resumed['statusCode'] == 200, resumed
        body = _body(resumed)
        assert body['csrfToken'] == security_utils.csrf_token_for(body['accessToken'])

        refreshed = lambda_handler(make_event('POST', '/api/auth/refresh',
                                              cookies=['pathsgames.refreshToken=MOCK_REFRESH_u-1']), {})
        assert refreshed['statusCode'] == 200, refreshed
        body = _body(refreshed)
        assert body['csrfToken'] == security_utils.csrf_token_for(body['accessToken'])


def test_me_carries_the_csrf_token_of_the_bearer():
    from common import security_utils
    from auth.handler import lambda_handler
    with patch('auth.handler.db_utils.get_item', return_value=_guest_row()):
        result = lambda_handler(make_event('GET', '/api/auth/me',
                                           headers={'Authorization': 'Bearer MOCK_ACCESS_u-1'}), {})
    assert result['statusCode'] == 200, result
    assert _body(result)['csrfToken'] == security_utils.csrf_token_for('MOCK_ACCESS_u-1')


# ── match handler wiring ──────────────────────────────────────────────────────

def _match_event(csrf=None, ip='1.1.1.1'):
    headers = {'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'}
    if csrf is not None:
        headers['X-CSRF-TOKEN'] = csrf
    event = make_event('POST', '/api/matches', headers=headers,
                       body={'storyUuid': 's', 'difficultyUuid': 'd'})
    event['requestContext'] = {'http': {'sourceIp': ip, 'method': 'POST', 'path': '/api/matches'}}
    return event


@pytest.fixture
def match_creation(monkeypatch):
    """A match handler whose creation is short-circuited right after the Step 41 gates."""
    import match.handler as handler
    monkeypatch.setattr(handler, '_resolve_user', lambda event: ({'uuid': 'player-uuid-001', 'role': 'PLAYER', 'state': 6}, None))
    created = MagicMock(return_value=handler._ok({'uuid': 'm-1'}, status=201))
    monkeypatch.setattr(handler, '_create_match', created)
    return handler, created


def test_match_creation_demands_the_csrf_token(monkeypatch, match_creation):
    from common import security_utils
    handler, created = match_creation
    monkeypatch.setenv('CSRF_ENFORCED', 'true')
    missing = handler.lambda_handler(_match_event(), {})
    assert missing['statusCode'] == 403 and _body(missing)['error'] == 'CSRF_TOKEN_MISSING'
    wrong = handler.lambda_handler(_match_event(csrf=security_utils.csrf_token_for('other')), {})
    assert wrong['statusCode'] == 403 and _body(wrong)['error'] == 'CSRF_TOKEN_INVALID'
    created.assert_not_called()
    ok = handler.lambda_handler(_match_event(csrf=security_utils.csrf_token_for('MOCK_ACCESS_player-uuid-001')), {})
    assert ok['statusCode'] == 201
    created.assert_called_once()


def test_match_creation_not_enforced_needs_no_header(match_creation):
    handler, created = match_creation
    assert handler.lambda_handler(_match_event(), {})['statusCode'] == 201
    created.assert_called_once()


def test_match_creation_is_rate_limited_after_the_csrf_check(monkeypatch, match_creation):
    from common import security_utils, db_utils
    handler, created = match_creation
    table = _Counter()
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    monkeypatch.setenv('CSRF_ENFORCED', 'true')
    monkeypatch.setenv('RATE_LIMIT_MATCH_PER_IP', '1')
    token = security_utils.csrf_token_for('MOCK_ACCESS_player-uuid-001')
    assert handler.lambda_handler(_match_event(ip='3.3.3.3'), {})['statusCode'] == 403
    assert table.calls == [], 'a forged call must not spend the window'
    assert handler.lambda_handler(_match_event(csrf=token, ip='3.3.3.3'), {})['statusCode'] == 201
    refused = handler.lambda_handler(_match_event(csrf=token, ip='3.3.3.3'), {})
    assert refused['statusCode'] == 429 and _body(refused)['error'] == 'RATE_LIMITED'
    assert refused['headers']['Retry-After']
    assert handler.lambda_handler(_match_event(csrf=token, ip='4.4.4.4'), {})['statusCode'] == 201
    assert created.call_count == 2
