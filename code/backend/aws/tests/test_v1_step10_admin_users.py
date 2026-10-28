"""v1.7.0 step 10 on AWS: USERSTATE# / GOOGLE_USER_LIST keys, the admin users list, ban / suspend / unblock /
re-link / deletion with the intervention log, banned hashes at login, suspension end, pepper guard."""
import json
import time
from unittest.mock import MagicMock, patch

import pytest

from helpers import make_event
from common import account_guard, admin_log, db_utils, jwt_utils, sso, user_admin
from test_v1_google_sso import MemDb, body, fake, login

DAY = 86_400_000


@pytest.fixture
def mem(monkeypatch):
    m = MemDb()
    for name in ('get_item', 'put_item', 'put_item_if_absent', 'delete_item', 'delete_all_by_pk', 'query_gsi',
                 'query_sk_prefix', 'update_attributes', 'increment_counter', 'update_ts_last_access',
                 'query_gsi_range'):
        monkeypatch.setattr(db_utils, name, getattr(m, name))
    monkeypatch.setenv('ENV', 'dev')
    monkeypatch.delenv('BANNED_SUBJECT_PEPPER', raising=False)
    monkeypatch.setattr(jwt_utils, 'ALLOW_MOCK_ACCESS', False)
    return m


def call(method, path, token, body_=None, qs=None):
    from auth.handler import lambda_handler
    event = make_event(method, path, body=body_, qs=qs, headers={'Authorization': f'Bearer {token}'})
    return lambda_handler(event, {})


@pytest.fixture
def admin(mem):
    return sso.create_admin('owner_admin')


def google_user(mem, sub='sub-1', email='Mario.Rossi+x@Gmail.com'):
    return body(login(mem, fake(sub=sub, email=email)))


def logs(mem, action=None):
    return [v for (pk, _), v in mem.items.items() if pk.startswith('ADMINLOG#')
            and (action is None or v.get('action') == action)]


# ── keys ─────────────────────────────────────────────────────────────────────

def test_index_keys_summary_and_guests():
    user = {'PK': 'USER#u', 'uuid': 'u', 'nickname': 'Alice', 'state': 2, 'email': 'a@gmail.com',
            'ts_registration': 5, 'role': 'PLAYER'}
    keys = sso.index_keys(user)
    assert keys['GSI1_PK'] == 'USERSTATE#2' and keys['GSI1_SK'] == 'alice#u'
    assert keys['GSI2_PK'] == 'GOOGLE_USER_LIST' and keys['GSI2_SK'] == f'{5:013d}#u'
    assert keys['summary']['account_type'] == 'GOOGLE' and keys['summary']['state'] == 2
    deleting = sso.index_keys({**user, 'state': 7})
    assert deleting['GSI2_PK'] == 'DELETING_USERS' and deleting['GSI1_PK'] == 'USERSTATE#7'
    assert sso.index_keys({'uuid': 'g', 'is_guest': True}) == {}
    assert sso.account_type({}) == 'INTERNAL'


def test_login_writes_the_keys_and_last_access_once_a_day(mem):
    uuid = google_user(mem)['userUuid']
    user = mem.get_item(f'USER#{uuid}')
    assert user['GSI1_PK'] == 'USERSTATE#2' and user['GSI1_SK'].endswith(f'#{uuid}')
    assert user['GSI2_SK'].endswith(f'#{uuid}') and user['summary']['account_type'] == 'GOOGLE'
    now = int(user['ts_last_access'])
    sso.touch_last_access(user, now + 1)
    assert mem.get_item(f'USER#{uuid}')['GSI2_SK'] == user['GSI2_SK']
    sso.touch_last_access(mem.get_item(f'USER#{uuid}'), now + DAY)
    assert mem.get_item(f'USER#{uuid}')['GSI2_SK'] == f'{now + DAY:013d}#{uuid}'
    mem.put_item({'PK': 'USER#g', 'SK': 'METADATA', 'uuid': 'g', 'is_guest': True, 'summary': {}})
    sso.touch_last_access(mem.get_item('USER#g'), 7)
    assert mem.get_item('USER#g')['summary']['ts_last_access'] == 7
    mem.put_item({'PK': 'USER#h', 'SK': 'METADATA', 'uuid': 'h', 'is_guest': True})
    sso.touch_last_access(mem.get_item('USER#h'), 8)
    assert 'summary' not in mem.get_item('USER#h')


def test_admin_bootstrap_has_the_keys(mem, admin):
    item = mem.get_item(f"USER#{admin['userUuid']}")
    assert item['GSI1_PK'] == 'USERSTATE#2' and item['summary']['role'] == 'ADMIN'


# ── list ─────────────────────────────────────────────────────────────────────

def test_list_default_state_nickname_email_and_cursor(mem, admin):
    a = google_user(mem, 'sub-a', 'alice@gmail.com')['userUuid']
    b = google_user(mem, 'sub-b', 'alberto@gmail.com')['userUuid']
    c = google_user(mem, 'sub-c', 'bob@gmail.com')['userUuid']
    mem.update_attributes(f'USER#{b}', 'METADATA', {'GSI2_SK': f'{9_999_999_999_999:013d}#{b}'})
    sso.save_state(mem.get_item(f'USER#{c}'), 3, extra={'suspended_until': '2099-01-01T00:00:00Z'})
    token = admin['accessToken']
    page = body(call('GET', '/api/admin/users', token, qs={'limit': '1'}))
    assert [i['uuid'] for i in page['items']] == [b] and page['nextCursor'] and 'email' not in page['items'][0]
    rest = body(call('GET', '/api/admin/users', token, qs={'cursor': page['nextCursor']}))
    assert c not in [i['uuid'] for i in rest['items']] and a in [i['uuid'] for i in rest['items']]
    by_nick = body(call('GET', '/api/admin/users', token, qs={'nickname': 'AL'}))
    assert [i['uuid'] for i in by_nick['items']] == [b, a]
    first = body(call('GET', '/api/admin/users', token, qs={'nickname': 'al', 'limit': '1'}))
    second = body(call('GET', '/api/admin/users', token, qs={'nickname': 'al', 'cursor': first['nextCursor']}))
    assert [i['uuid'] for i in second['items']] == [a] and second['nextCursor'] is None
    blocked = body(call('GET', '/api/admin/users', token, qs={'state': '3'}))
    assert [i['uuid'] for i in blocked['items']] == [c] and blocked['items'][0]['suspendedUntil']
    after = body(call('GET', '/api/admin/users', token, qs={'state': '2', 'limit': '1'}))
    nxt = body(call('GET', '/api/admin/users', token, qs={'state': '2', 'cursor': after['nextCursor']}))
    assert after['items'][0]['uuid'] not in [i['uuid'] for i in nxt['items']]
    assert [i['uuid'] for i in body(call('GET', '/api/admin/users', token,
                                         qs={'email': 'Alice@Gmail.com'}))['items']] == [a]
    assert body(call('GET', '/api/admin/users', token, qs={'email': 'alice@gmail.com', 'state': '3'}))['items'] == []
    bad = call('GET', '/api/admin/users', token, qs={'state': '6'})
    assert bad['statusCode'] == 400 and body(bad)['error'] == 'INVALID_INPUT'


def test_list_helpers():
    assert user_admin.clamp(None) == 50 and user_admin.clamp('x') == 50 and user_admin.clamp(999) == 200
    assert user_admin.decode_cursor(user_admin.encode_cursor('alice#u')) == 'alice#u'
    assert user_admin.decode_cursor(None) is None and user_admin.decode_cursor('@@@') is None
    assert user_admin.decode_cursor('/w') is None
    assert user_admin.parse_state(' ') is None and user_admin.parse_state('3') == 3
    with pytest.raises(user_admin.UserAdminError):
        user_admin.parse_state('x')
    assert user_admin.UserAdminError('USER_NOT_FOUND', 'm').status == 404
    assert user_admin.item_of(None)['accountType'] == 'INTERNAL'


# ── ban / unblock ────────────────────────────────────────────────────────────

def test_ban_blocks_both_hashes_and_unblock_restores(mem, admin):
    data = google_user(mem)
    uuid = data['userUuid']
    mem.put_item({'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING', 'ts_update': 5,
                  'GSI1_PK': f'USER_MATCHES#{uuid}', 'summary': {'status': 'RUNNING'}})
    mem.put_item({'PK': 'MATCH#m2', 'SK': 'METADATA', 'uuid': 'm2', 'status': 'ENDED',
                  'GSI1_PK': f'USER_MATCHES#{uuid}', 'summary': {'status': 'ENDED'}})
    mem.put_item({'PK': 'MATCH#m3', 'SK': 'METADATA', 'uuid': 'm3', 'status': 'ENDED',
                  'GSI1_PK': f'USER_MATCHES#{uuid}', 'summary': {'status': 'PAUSED'}})
    token = admin['accessToken']
    done = body(call('POST', f'/api/admin/users/{uuid}/ban', token, {'reason': 'cheating'}))
    assert done['state'] == 4 and done['bannedMatchUuids'] == ['m1']
    assert mem.get_item('MATCH#m1')['status'] == 'BANNED' and mem.get_item('MATCH#m1')['ts_update'] > 5
    assert mem.get_item('MATCH#m2')['status'] == 'ENDED'
    user = mem.get_item(f'USER#{uuid}')
    assert user['GSI1_PK'] == 'USERSTATE#4' and set(user['ban_hashes']) == {'BANSUB', 'BANEMAIL'}
    assert [l['action'] for l in logs(mem)] == ['BAN'] and logs(mem)[0]['admin_uuid'] == admin['userUuid']
    assert logs(mem)[0]['ttl'] > time.time() + 700 * 86400
    # same email with a new Google account, and the same sub: both refused
    assert body(login(mem, fake(sub='sub-new')))['error'] == 'ACCOUNT_DISABLED'
    assert body(login(mem, fake(sub='sub-1', email='other@gmail.com')))['error'] == 'ACCOUNT_DISABLED'
    again = call('POST', f'/api/admin/users/{uuid}/ban', token, {'reason': 'twice'})
    assert again['statusCode'] == 409 and body(again)['error'] == 'INVALID_STATE_TRANSITION'
    detail = body(call('GET', f'/api/admin/users/{uuid}', token))
    assert detail['banned'] is True and detail['identities'][0]['subject'] == 'sub-1' and detail['sessions'] == 0
    assert body(call('POST', f'/api/admin/users/{uuid}/unblock', token, {'reason': 'appeal'}))['state'] == 2
    assert not account_guard.is_banned('sub-1', 'mario.rossi+x@gmail.com')
    assert mem.get_item('MATCH#m1')['status'] == 'BANNED'
    assert body(login(mem, fake()))['userUuid'] == uuid
    assert [l['action'] for l in logs(mem)] == ['BAN', 'UNBLOCK']


def test_ban_of_a_deleting_user_keeps_state_7(mem):
    uuid = google_user(mem)['userUuid']
    sso.save_state(mem.get_item(f'USER#{uuid}'), 7)
    assert user_admin.ban('adm', uuid, 'fraud')['state'] == 7
    assert account_guard.is_banned('sub-1', None)
    assert mem.get_item(f'USER#{uuid}')['GSI2_PK'] == 'DELETING_USERS'


def test_refusals_write_no_log(mem, admin):
    token = admin['accessToken']
    guest = {'PK': 'USER#g', 'SK': 'METADATA', 'uuid': 'g', 'is_guest': True, 'state': 6}
    mem.put_item(guest)
    cases = [('ban', 'g', {'reason': 'r'}, 400, 'GUEST_NOT_BANNABLE'),
             ('ban', admin['userUuid'], {'reason': 'r'}, 400, 'ADMIN_NOT_BANNABLE'),
             ('suspend', admin['userUuid'], {'reason': 'r', 'until': '2099-01-01'}, 400, 'ADMIN_NOT_BANNABLE'),
             ('ban', 'missing', {'reason': 'r'}, 404, 'USER_NOT_FOUND'),
             ('ban', 'g', {}, 400, 'INVALID_INPUT'),
             ('ban', 'g', {'reason': 'x' * 501}, 400, 'INVALID_INPUT'),
             ('unblock', 'g', {'reason': 'r'}, 409, 'INVALID_STATE_TRANSITION'),
             ('relink-subject', 'g', {'reason': 'r'}, 409, 'INVALID_STATE_TRANSITION'),
             ('deletion', 'g', {'reason': 'r'}, 400, 'GUEST_NOT_BANNABLE')]
    for action, uuid, payload, status, code in cases:
        response = call('POST', f'/api/admin/users/{uuid}/{action}', token, payload)
        assert (response['statusCode'], body(response)['error']) == (status, code), action
    assert call('POST', '/api/admin/users/g/whatever', token, {'reason': 'r'})['statusCode'] == 404
    assert logs(mem) == []
    with pytest.raises(user_admin.UserAdminError):
        user_admin.ban('a', ' ', 'r')


# ── suspend ──────────────────────────────────────────────────────────────────

def test_suspend_refuses_login_then_unblocks_after_the_date(mem, admin):
    uuid = google_user(mem)['userUuid']
    token = admin['accessToken']
    for bad in (None, 'soon', '2020-01-01T00:00:00Z', '2999-01-01'):
        response = call('POST', f'/api/admin/users/{uuid}/suspend', token, {'reason': 'r', 'until': bad})
        assert body(response)['error'] == 'SUSPEND_UNTIL_INVALID'
    until = time.strftime('%Y-%m-%d', time.gmtime(time.time() + 10 * 86400))
    done = body(call('POST', f'/api/admin/users/{uuid}/suspend', token, {'reason': 'rude', 'until': until}))
    assert done['state'] == 3 and done['suspendedUntil'].startswith(until)
    refused = login(mem)
    assert body(refused)['error'] == 'ACCOUNT_DISABLED' and body(refused)['suspendedUntil'] == done['suspendedUntil']
    mem.update_attributes(f'USER#{uuid}', 'METADATA', {'suspended_until': '2020-01-01T00:00:00Z'})
    assert body(login(mem))['userUuid'] == uuid
    user = mem.get_item(f'USER#{uuid}')
    assert user['state'] == 2 and 'suspended_until' not in user and user['GSI1_PK'] == 'USERSTATE#2'
    assert [(l['action'], l['admin_uuid']) for l in logs(mem)] == [('SUSPEND', admin['userUuid']),
                                                                    ('UNBLOCK', 'SYSTEM')]
    sso.save_state(user, 4)
    assert body(call('POST', f'/api/admin/users/{uuid}/suspend', token,
                     {'reason': 'r', 'until': until}))['error'] == 'INVALID_STATE_TRANSITION'


def test_v1_10_the_dev_endpoint_ends_a_suspension_and_the_next_login_unblocks(mem, admin):
    from seed.handler import lambda_handler as dev
    uuid = google_user(mem)['userUuid']
    until = time.strftime('%Y-%m-%d', time.gmtime(time.time() + 10 * 86400))
    call('POST', f'/api/admin/users/{uuid}/suspend', admin['accessToken'], {'reason': 'rude', 'until': until})
    done = dev(make_event('POST', f'/api/dev/users/{uuid}/expire-suspension'), {})
    assert done['statusCode'] == 200
    answer = body(done)
    assert answer['userUuid'] == uuid and answer['state'] == 3 and answer['suspendedUntil'] < until
    assert len(logs(mem, 'SUSPEND')) == 1 and len(logs(mem)) == 1  # no log row of its own
    assert body(login(mem))['userUuid'] == uuid and mem.get_item(f'USER#{uuid}')['state'] == 2
    again = dev(make_event('POST', f'/api/dev/users/{uuid}/expire-suspension'), {})
    assert again['statusCode'] == 409 and body(again)['error'] == 'INVALID_STATE_TRANSITION'
    unknown = dev(make_event('POST', '/api/dev/users/nope/expire-suspension'), {})
    assert unknown['statusCode'] == 404 and body(unknown)['error'] == 'USER_NOT_FOUND'


def test_admit_rules():
    assert sso.admit(None) is None
    with pytest.raises(sso.AuthError) as e:
        sso.admit({'uuid': 'u', 'state': 3})
    assert e.value.suspended_until is None
    with pytest.raises(sso.AuthError):
        sso.admit({'uuid': 'u', 'state': 3, 'suspended_until': 'garbage'})
    assert sso._iso_ms('2026-01-01T00:00:00') == 1767225600000


def test_refresh_after_the_suspension_unblocks(mem):
    google_user(mem)
    uuid = next(v['uuid'] for (pk, _), v in mem.items.items() if pk.startswith('USER#'))
    sso.save_state(mem.get_item(f'USER#{uuid}'), 3, extra={'suspended_until': '2020-01-01T00:00:00Z'})
    refresh_item = {'user_uuid': uuid, 'revoked': False, 'expires_at': 9_999_999_999_999, 'PK': 'x', 'SK': 'y'}
    with patch('common.auth_tokens.find_refresh', return_value=refresh_item), \
            patch('common.jwt_utils.decode_refresh_token', return_value={'uuid': uuid}), \
            patch('common.auth_tokens.mark_rotated'):
        result = sso.refresh('token')
    assert result[0]['state'] == 2


# ── relink and deletion ──────────────────────────────────────────────────────

def test_relink_replaces_the_subject_once(mem, admin):
    uuid = google_user(mem)['userUuid']
    token = admin['accessToken']
    assert body(login(mem, fake(sub='sub-2')))['error'] == 'IDENTITY_MISMATCH'
    assert body(call('POST', f'/api/admin/users/{uuid}/relink-subject', token, {'reason': 'new'}))['relinkPending']
    assert body(login(mem, fake(sub='sub-2')))['userUuid'] == uuid
    pointer = mem.get_item('EMAIL#mario.rossi+x@gmail.com')
    assert pointer['provider_subject'] == 'sub-2'
    assert mem.get_item('IDENTITY#GOOGLE#sub-1', 'EMAIL#mario.rossi+x@gmail.com') is None
    assert 'relink_pending' not in mem.get_item(f'USER#{uuid}')
    assert body(login(mem, fake(sub='sub-1')))['error'] == 'IDENTITY_MISMATCH'


def test_deletion_of_the_old_user(mem, admin):
    uuid = google_user(mem)['userUuid']
    token = admin['accessToken']
    assert body(call('POST', f'/api/admin/users/{uuid}/deletion', token, {'reason': 'mismatch'}))['state'] == 7
    assert mem.get_item(f'USER#{uuid}')['GSI2_PK'] == 'DELETING_USERS'
    again = call('POST', f'/api/admin/users/{uuid}/deletion', token, {'reason': 'twice'})
    assert body(again)['error'] == 'INVALID_STATE_TRANSITION'
    assert body(call('POST', f'/api/admin/users/{uuid}/relink-subject', token,
                     {'reason': 'r'}))['error'] == 'INVALID_STATE_TRANSITION'
    assert [l['action'] for l in logs(mem)] == ['DELETE_OLD_USER']


# ── pepper, log, db helper ───────────────────────────────────────────────────

def test_pepper_hashes_and_misconfiguration(monkeypatch, mem):
    assert account_guard.hash_email(' A@Gmail.com ') == account_guard.hash_email('a@gmail.com')
    assert account_guard.hash_subject(None) is None and account_guard.hash_email('') is None
    monkeypatch.setenv('BANNED_SUBJECT_PEPPER', 'stage-pepper')
    assert account_guard.pepper() == 'stage-pepper'
    assert not account_guard.misconfigured()
    monkeypatch.setenv('ENV', 'prod')
    assert not account_guard.misconfigured()
    monkeypatch.delenv('BANNED_SUBJECT_PEPPER')
    assert account_guard.misconfigured()
    from auth.handler import lambda_handler
    with patch('common.jwt_utils.JWT_SECRET', 'a-private-prod-secret-of-at-least-32-chars'):
        response = lambda_handler(make_event('GET', '/api/admin/users'), {})
    assert response['statusCode'] == 500 and json.loads(response['body'])['error'] == 'MISCONFIGURED'
    assert account_guard.store('u', None, None) == {}
    account_guard.remove(None)


def test_admin_log_item(mem):
    admin_log.record(None, 'BAN', 't', 'why', now_ms=1_767_225_600_000)
    row = logs(mem)[0]
    assert row['PK'] == 'ADMINLOG#2026-01' and row['SK'].startswith('1767225600000#')
    assert row['admin_uuid'] == 'UNKNOWN' and row['ttl'] == 1_767_225_600 + 731 * 86400


def test_query_gsi_range_builds_the_key_condition(monkeypatch):
    table = MagicMock()
    table.query.return_value = {'Items': []}
    monkeypatch.setattr(db_utils, '_get_table', lambda: table)
    for op, args in ((None, ()), ('begins_with', ('a',)), ('gt', ('a',)), ('lt', ('a',)), ('between', ('a', 'b'))):
        assert db_utils.query_gsi_range('GSI1', 'USERSTATE#2', op, *args, ascending=False) == []
    assert table.query.call_args.kwargs['ScanIndexForward'] is False
    from botocore.exceptions import ClientError
    table.query.side_effect = ClientError({'Error': {'Code': 'X', 'Message': 'm'}}, 'query')
    assert db_utils.query_gsi_range('GSI2', 'GOOGLE_USER_LIST') == []


def test_admin_routes_need_an_admin_and_stale_summaries_are_skipped(mem):
    player = google_user(mem)
    token = player['accessToken']
    assert call('GET', '/api/admin/users', token)['statusCode'] == 403
    assert call('POST', f"/api/admin/users/{player['userUuid']}/ban", token, {'reason': 'r'})['statusCode'] == 403
    mem.put_item({'PK': 'MATCH#gone', 'SK': 'X', 'GSI1_PK': 'USER_MATCHES#u9', 'summary': {'status': 'RUNNING'}})
    assert user_admin._ban_active_matches('u9') == []
