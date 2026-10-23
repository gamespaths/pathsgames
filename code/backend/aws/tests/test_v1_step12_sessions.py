"""v1.7.0 step 12 on AWS: cap of 12 with SESSION_LIMIT, revocation reasons and 7-day ttl, reuse detection,
sessions_valid_after, refresh 250 days (guests 180), activeSessions, SameSite, admin stories and matches paging."""
import json
import time
from unittest.mock import patch

import pytest

from helpers import admin_event, make_event
from common import auth_tokens, db_utils, jwt_utils, sso, user_admin
from test_v1_google_sso import MemDb, _cookie, body, fake, login

DAY_S = 86_400


@pytest.fixture
def mem(monkeypatch):
    m = MemDb()
    for name in ('get_item', 'put_item', 'put_item_if_absent', 'delete_item', 'delete_all_by_pk', 'query_gsi',
                 'query_sk_prefix', 'update_attributes', 'increment_counter', 'update_ts_last_access',
                 'query_gsi_range'):
        monkeypatch.setattr(db_utils, name, getattr(m, name))
    monkeypatch.setenv('ENV', 'dev')
    monkeypatch.delenv('BANNED_SUBJECT_PEPPER', raising=False)
    monkeypatch.delenv('COOKIE_SAME_SITE', raising=False)
    monkeypatch.delenv('MAX_SESSIONS_PER_USER', raising=False)
    monkeypatch.setattr(jwt_utils, 'ALLOW_MOCK_ACCESS', False)
    return m


def refresh(cookie):
    from auth.handler import lambda_handler
    return lambda_handler(make_event('POST', '/api/auth/refresh', cookies=[cookie]), {})


def me(token):
    from auth.handler import lambda_handler
    return lambda_handler(make_event('GET', '/api/auth/me', headers={'Authorization': f'Bearer {token}'}), {})


def item_of(cookie):
    return auth_tokens.find_refresh(cookie.split('=', 1)[1])


# ── cap, reasons, reuse ──────────────────────────────────────────────────────

def test_the_thirteenth_session_evicts_the_first_with_session_limit(mem):
    sessions = [login(mem, fake()) for _ in range(13)]
    first = _cookie(sessions[0], 'pathsgames.refreshToken=')
    assert item_of(first)['revoked_reason'] == auth_tokens.LIMIT
    limited = refresh(first)
    assert limited['statusCode'] == 401 and body(limited)['error'] == 'SESSION_LIMIT'
    assert 'Max-Age=0' in limited['cookies'][0]
    assert refresh(_cookie(sessions[-1], 'pathsgames.refreshToken='))['statusCode'] == 200


def test_rotation_and_logout_keep_the_item_7_days_limit_keeps_its_expiry(mem):
    session = login(mem)
    cookie = _cookie(session, 'pathsgames.refreshToken=')
    expiry_ttl = item_of(cookie)['ttl']
    assert expiry_ttl > time.time() + 249 * DAY_S
    assert refresh(cookie)['statusCode'] == 200
    rotated = item_of(cookie)
    assert rotated['revoked_reason'] == auth_tokens.ROTATED
    assert time.time() + 6 * DAY_S < rotated['ttl'] <= time.time() + 7 * DAY_S + 1
    auth_tokens.revoke({**rotated, 'revoked': False, 'ttl': None})
    assert item_of(cookie)['revoked_reason'] == auth_tokens.LOGOUT
    other = _cookie(login(mem), 'pathsgames.refreshToken=')
    auth_tokens.enforce_cap(body(session)['userUuid'], cap=0)
    assert item_of(other)['revoked_reason'] == auth_tokens.LIMIT and item_of(other)['ttl'] > time.time() + 200 * DAY_S


def test_a_rotated_token_reused_after_the_grace_revokes_every_session(mem):
    session = login(mem)
    uuid = body(session)['userUuid']
    old = _cookie(session, 'pathsgames.refreshToken=')
    fresh = refresh(old)
    assert refresh(old)['statusCode'] == 200  # inside the 2-minute grace
    mem.update_attributes(item_of(old)['PK'], 'METADATA', {'ts_rotated': int(time.time() * 1000) - 121_000})
    reused = refresh(old)
    assert reused['statusCode'] == 401 and body(reused)['error'] == 'SESSION_REVOKED'
    assert auth_tokens.active_sessions(uuid) == []
    assert mem.get_item(f'USER#{uuid}')['sessions_valid_after'] >= int(time.time()) - 1
    new_cookie = [c for c in fresh['cookies'] if c.startswith('pathsgames.refreshToken=')][0].split(';')[0]
    assert body(refresh(new_cookie))['error'] == 'SESSION_REVOKED'


def test_reuse_of_a_deleted_user_cuts_nothing_and_a_ttl_expired_item_is_unknown(mem):
    mem.put_item({'PK': f"REFRESH#{auth_tokens.sha256('a.b.c')}", 'SK': 'METADATA', 'user_uuid': 'gone',
                  'revoked': True, 'revoked_reason': 'ROTATED', 'ts_rotated': 0})
    with patch('common.jwt_utils.decode_refresh_token', return_value={'sub': 'gone'}):
        with pytest.raises(sso.AuthError) as e:
            sso.refresh('a.b.c')
        assert e.value.code == 'SESSION_REVOKED'
        assert mem.get_item('USER#gone') is None
        mem.update_attributes(f"REFRESH#{auth_tokens.sha256('a.b.c')}", 'METADATA', {'ttl': 1})
        assert sso.refresh('a.b.c') is None
    assert auth_tokens.expired_by_ttl({'ttl': 1}) and not auth_tokens.expired_by_ttl({})


# ── sessions_valid_after ─────────────────────────────────────────────────────

def test_logout_all_refuses_older_access_tokens_with_session_revoked(mem):
    from auth.handler import lambda_handler
    data = body(login(mem))
    token, uuid = data['accessToken'], data['userUuid']
    assert me(token)['statusCode'] == 200
    out = lambda_handler(make_event('POST', '/api/auth/logout/all', headers={'Authorization': f'Bearer {token}'}), {})
    assert out['statusCode'] == 200
    assert mem.get_item(f'USER#{uuid}')['sessions_valid_after'] >= int(time.time()) - 1
    # same second: still valid (iat >= value); one second later the token is older
    mem.update_attributes(f'USER#{uuid}', 'METADATA', {'sessions_valid_after': int(time.time()) + 2})
    refused = me(token)
    assert refused['statusCode'] == 401 and body(refused)['error'] == 'SESSION_REVOKED'
    user, err = sso.resolve_user(token)
    assert user is None and err[1] == 'SESSION_REVOKED'


def test_mock_tokens_without_iat_skip_the_check(mem, monkeypatch):
    monkeypatch.setattr(jwt_utils, 'ALLOW_MOCK_ACCESS', True)
    mem.put_item({'PK': 'USER#m', 'SK': 'METADATA', 'uuid': 'm', 'state': 2, 'sessions_valid_after': 9e12})
    user, err = sso.resolve_user('MOCK_ACCESS_m')
    assert err is None and user['uuid'] == 'm'


def test_ban_and_suspend_cut_the_sessions_with_reason_admin(mem):
    admin = sso.create_admin('owner_admin')
    for action, payload in (('ban', {'reason': 'cheating'}), ('suspend', None)):
        data = body(login(mem, fake(sub=f'sub-{action}', email=f'{action}@gmail.com')))
        uuid = data['userUuid']
        cookie_item = auth_tokens.active_sessions(uuid)[0]
        if action == 'ban':
            user_admin.ban(admin['userUuid'], uuid, 'cheating')
        else:
            until = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + 5 * DAY_S))
            user_admin.suspend(admin['userUuid'], uuid, until, 'cooling off')
        assert auth_tokens.active_sessions(uuid) == []
        assert mem.get_item(cookie_item['PK'])['revoked_reason'] == auth_tokens.ADMIN
        assert mem.get_item(f'USER#{uuid}')['sessions_valid_after'] >= int(time.time()) - 1
    deleted = body(login(mem, fake(sub='sub-del', email='del@gmail.com')))['userUuid']
    user_admin.delete_user(admin['userUuid'], deleted, 'old account')
    assert mem.get_item(f'USER#{deleted}')['sessions_valid_after'] > 0


# ── lifetimes, activeSessions, cookies ───────────────────────────────────────

def test_refresh_lasts_250_days_and_a_guest_180(mem):
    from auth.handler import lambda_handler
    now_ms = int(time.time() * 1000)
    google = login(mem)
    assert abs(body(google)['refreshTokenExpiresAt'] - (now_ms + 250 * DAY_S * 1000)) < 60_000
    assert 'Max-Age=21600000' in _cookie_line(google, 'pathsgames.refreshToken=')
    with patch('auth.handler.security_utils.guest_per_ip', return_value=0):
        guest = lambda_handler(make_event('POST', '/api/auth/guest'), {})
    assert abs(body(guest)['refreshTokenExpiresAt'] - (now_ms + 180 * DAY_S * 1000)) < 60_000
    assert 'Max-Age=15552000' in _cookie_line(guest, 'pathsgames.guestcookie=')
    assert sso.REFRESH_SECONDS == 250 * DAY_S and sso.GUEST_REFRESH_SECONDS == 180 * DAY_S


def _cookie_line(result, name):
    return [c for c in result['cookies'] if c.startswith(name)][0]


def test_me_counts_the_sessions_of_the_last_30_days(mem):
    sessions = [body(login(mem)) for _ in range(3)]
    uuid = sessions[0]['userUuid']
    old = auth_tokens.active_sessions(uuid)[0]
    stale = int(time.time() * 1000) - 31 * DAY_S * 1000
    mem.update_attributes(old['PK'], 'METADATA', {'GSI1_SK': f'REFRESH#{stale:013d}'})
    data = body(me(sessions[-1]['accessToken']))
    assert data['activeSessions'] == 2
    assert len(auth_tokens.active_sessions(uuid)) == 3


def test_same_site_parameter_and_max_sessions_env(monkeypatch):
    from auth import handler
    assert handler._same_site() == 'Lax'
    for raw, expected in (('none', 'None'), ('Strict', 'Strict'), ('bogus', 'Lax')):
        monkeypatch.setenv('COOKIE_SAME_SITE', raw)
        assert handler._same_site() == expected
    monkeypatch.setenv('COOKIE_SAME_SITE', 'None')
    assert 'SameSite=None' in handler._refresh_cookie('r') and 'SameSite=None' in handler._clear_cookies()[0]
    assert auth_tokens.max_sessions() == 12
    monkeypatch.setenv('MAX_SESSIONS_PER_USER', '3')
    assert auth_tokens.max_sessions() == 3
    for bad in ('x', '0'):
        monkeypatch.setenv('MAX_SESSIONS_PER_USER', bad)
        assert auth_tokens.max_sessions() == 12


def test_story_admin_guard_keeps_session_revoked(monkeypatch):
    from story import handler
    monkeypatch.setattr(handler, '_check_admin_ip', lambda event: None)
    monkeypatch.setattr(handler.sso, 'resolve_user', lambda token: (None, (401, 'SESSION_REVOKED', 'closed')))
    _, err = handler._require_admin(make_event('GET', '/api/admin/stories'))
    assert json.loads(err['body'])['error'] == 'SESSION_REVOKED'
    monkeypatch.setattr(handler.sso, 'resolve_user', lambda token: (None, (401, 'INVALID_TOKEN', 'bad')))
    _, err = handler._require_admin(make_event('GET', '/api/admin/stories'))
    assert json.loads(err['body'])['error'] == 'UNAUTHORIZED'


# ── admin stories envelope ───────────────────────────────────────────────────

ADMIN_USER = {'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001', 'role': 'ADMIN', 'state': 2}


def _story(i, priority):
    return {'PK': f'STORY#s-{i}', 'SK': 'METADATA', 'uuid': f's-{i}', 'priority': priority, 'visibility': 'PUBLIC'}


def test_admin_stories_answer_the_cursor_envelope(monkeypatch):
    monkeypatch.setattr(jwt_utils, 'ALLOW_MOCK_ACCESS', True)
    from story import handler
    stories = [_story(i, 10 - i) for i in range(3)]
    with patch('story.handler.db_utils.get_item', return_value=ADMIN_USER), \
            patch('story.handler._story_list', return_value=stories):
        first = json.loads(handler.lambda_handler(admin_event('GET', '/api/admin/stories', qs={'limit': '2'}), {})['body'])
        assert [s['uuid'] for s in first['items']] == ['s-0', 's-1']
        assert first['nextCursor'] == '2' and first['limit'] == 2
        last = json.loads(handler.lambda_handler(admin_event('GET', '/api/admin/stories',
                                                             qs={'limit': '2', 'cursor': '2'}), {})['body'])
        assert [s['uuid'] for s in last['items']] == ['s-2'] and last['nextCursor'] is None
    assert handler._page_bounds({}) == (50, 0)
    assert handler._page_bounds({'limit': '999', 'cursor': 'bad'}) == (200, 0)
    assert handler._page_bounds({'limit': '0', 'cursor': '-3'}) == (1, 0)


# ── admin matches: key query and the 5-read loop ─────────────────────────────

def test_query_index_filled_loops_until_full_or_budget():
    reads = []

    def page(index, pk_name, pk_val, sk_name=None, sk_from=None, eq_filters=None, limit=50, start_key=None,
             ascending=False):
        reads.append((limit, start_key))
        return [{'uuid': f'm{len(reads)}'}], {'k': len(reads)}

    with patch('common.db_utils.query_index_page', side_effect=page):
        items, key = db_utils.query_index_filled('GSI2', 'GSI2_PK', 'MATCH', eq_filters={'summary.storyUuid': 's'},
                                                 limit=10, max_reads=5)
    assert len(items) == 5 and key == {'k': 5}
    assert reads[0] == (10, None) and reads[1] == (9, {'k': 1}) and reads[4] == (6, {'k': 4})
    reads.clear()
    with patch('common.db_utils.query_index_page', side_effect=page):
        items, _ = db_utils.query_index_filled('GSI2', 'GSI2_PK', 'MATCH', eq_filters={'summary.storyUuid': 's'},
                                               limit=2, max_reads=5)
    assert len(items) == 2 and len(reads) == 2
    reads.clear()
    with patch('common.db_utils.query_index_page', side_effect=page):
        db_utils.query_index_filled('GSI2', 'GSI2_PK', 'MATCH', eq_filters={'summary.status': None}, limit=9)
    assert len(reads) == 1
    with patch('common.db_utils.query_index_page', return_value=([], None)) as single:
        assert db_utils.query_index_filled('GSI2', 'GSI2_PK', 'MATCH', eq_filters={'x': 'y'}) == ([], None)
    assert single.call_count == 1


@patch('match.handler.db_utils.query_index_page')
@patch('match.handler.db_utils.get_item', return_value=ADMIN_USER)
def test_admin_matches_story_filter_reads_at_most_5_pages(mock_get, mock_page, monkeypatch):
    monkeypatch.setattr(jwt_utils, 'ALLOW_MOCK_ACCESS', True)
    mock_page.side_effect = [([], {'PK': f'MATCH#{i}', 'SK': 'METADATA'}) for i in range(1, 7)]
    from match.handler import lambda_handler
    result = lambda_handler(admin_event('GET', '/api/admin/matches', qs={'storyUuid': 's-7', 'limit': '20'}), {})
    data = json.loads(result['body'])
    assert result['statusCode'] == 200 and data['items'] == [] and data['nextCursor'] is not None
    assert mock_page.call_count == 5
    assert all(c.args[0] == 'GSI2' and c.args[2] == 'MATCH' for c in mock_page.call_args_list)
    assert db_utils.decode_cursor(data['nextCursor']) == {'PK': 'MATCH#5', 'SK': 'METADATA'}


@patch('match.handler.db_utils.query_index_page', return_value=([], None))
@patch('match.handler.db_utils.get_item', return_value=ADMIN_USER)
def test_admin_matches_user_filter_is_a_gsi1_key_query(mock_get, mock_page, monkeypatch):
    monkeypatch.setattr(jwt_utils, 'ALLOW_MOCK_ACCESS', True)
    from match.handler import lambda_handler
    lambda_handler(admin_event('GET', '/api/admin/matches', qs={'userUuid': 'u-9'}), {})
    args, kwargs = mock_page.call_args
    assert args[:3] == ('GSI1', 'GSI1_PK', 'USER_MATCHES#u-9')
    assert kwargs['sk_name'] == 'GSI1_SK' and kwargs['sk_from'] is None
    assert kwargs['eq_filters'] == {'summary.status': None, 'summary.storyUuid': None}
