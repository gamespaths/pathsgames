"""v1.2.0 Google SSO on AWS: verifier and fake provider, hashed sessions, login rules and guest merge,
refresh grace and SESSION_REVOKED, the requesting user, account deletion and jobs, admin bootstrap,
dev endpoints, echo, export/import identities and the db_utils helpers."""
import copy
import json
import os
import time
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import jwt
import pytest
from botocore.exceptions import ClientError
from cryptography.hazmat.primitives.asymmetric import rsa

from helpers import make_event
from common import auth_tokens, db_utils, google_verifier, jwt_utils, log_sanitizer, sso

CLIENT = google_verifier.DEV_CLIENT_ID


class MemDb:
    """In-memory stand-in of the db_utils calls the SSO code makes (GSI1/GSI2 by attribute)."""

    def __init__(self):
        self.items = {}

    def get_item(self, pk, sk='METADATA', consistent=True):
        it = self.items.get((pk, sk))
        return copy.deepcopy(it) if it else None

    def put_item(self, item):
        self.items[(item['PK'], item.get('SK', 'METADATA'))] = copy.deepcopy(item)
        return True

    def put_item_if_absent(self, item):
        if (item['PK'], item.get('SK', 'METADATA')) in self.items:
            return False
        return self.put_item(item)

    def delete_item(self, pk, sk='METADATA'):
        self.items.pop((pk, sk), None)
        return True

    def delete_all_by_pk(self, pk):
        keys = [k for k in self.items if k[0] == pk]
        for k in keys:
            del self.items[k]
        return len(keys)

    def query_gsi(self, index, pk, sk_prefix=None):
        key = 'GSI1_PK' if index == 'GSI1' else 'GSI2_PK'
        sort = 'GSI1_SK' if index == 'GSI1' else 'GSI2_SK'
        rows = [copy.deepcopy(v) for v in self.items.values() if v.get(key) == pk]
        return sorted(rows, key=lambda r: str(r.get(sort, '')))

    def query_gsi_range(self, index, pk, op=None, value=None, value2=None, ascending=True):
        sort = 'GSI1_SK' if index == 'GSI1' else 'GSI2_SK'
        tests = {None: lambda k: True, 'begins_with': lambda k: k.startswith(value), 'gt': lambda k: k > value,
                 'lt': lambda k: k < value, 'between': lambda k: value <= k <= value2}
        rows = [r for r in self.query_gsi(index, pk) if tests[op](str(r.get(sort, '')))]
        return rows if ascending else rows[::-1]

    def query_sk_prefix(self, pk, prefix, consistent=True, filter_expr=None):
        return [copy.deepcopy(v) for (p, s), v in self.items.items() if p == pk and s.startswith(prefix)]

    def update_attributes(self, pk, sk='METADATA', values=None, remove=()):
        item = self.items.setdefault((pk, sk), {'PK': pk, 'SK': sk})
        for key, value in (values or {}).items():
            target = item
            parts = key.split('.')
            for part in parts[:-1]:
                target = target.setdefault(part, {})
            target[parts[-1]] = value
        for key in remove:
            item.pop(key, None)
        return True

    def increment_counter(self, pk, sk='METADATA', attribute='counter'):
        item = self.items.setdefault((pk, sk), {'PK': pk, 'SK': sk})
        item[attribute] = item.get(attribute, 0) + 1
        return item[attribute]

    def update_ts_last_access(self, pk, now_ms, sk='METADATA', in_summary=False):
        self.update_attributes(pk, sk, {'ts_last_access': now_ms})
        return True


@pytest.fixture
def mem(monkeypatch):
    m = MemDb()
    for name in ('get_item', 'put_item', 'put_item_if_absent', 'delete_item', 'delete_all_by_pk', 'query_gsi',
                 'query_sk_prefix', 'update_attributes', 'increment_counter', 'update_ts_last_access',
                 'query_gsi_range'):
        monkeypatch.setattr(db_utils, name, getattr(m, name))
    monkeypatch.setenv('ENV', 'dev')
    monkeypatch.setattr(jwt_utils, 'ALLOW_MOCK_ACCESS', False)
    return m


def fake(**claims):
    base = {'sub': 'sub-1', 'email': 'Mario.Rossi+x@Gmail.com', 'nonce': 'n', 'name': 'Mario Rossi',
            'given_name': 'Mario', 'family_name': 'Rossi', 'picture': 'pic', 'locale': 'it-IT'}
    base.update(claims)
    return google_verifier.mint_fake(base)


def body(result):
    return json.loads(result['body'])


def login(mem, token=None, nonce='n', headers=None, cookies=None):
    from auth.handler import lambda_handler
    event = make_event('POST', '/api/auth/google', body={'idToken': token or fake(), 'nonce': nonce},
                       headers=headers or {}, cookies=cookies)
    return lambda_handler(event, {})


# ── jwt and verifier ────────────────────────────────────────────────────────

def test_mock_access_defaults_to_false_and_tokens_carry_iss_and_aud(monkeypatch):
    import importlib
    monkeypatch.delenv('ALLOW_MOCK_ACCESS', raising=False)
    fresh = importlib.reload(jwt_utils)
    assert fresh.ALLOW_MOCK_ACCESS is False
    monkeypatch.setenv('ENV', 'test')
    token = fresh.generate_access_token('u', 'n', 'PLAYER')
    assert fresh.verify_access_token(token)['uuid'] == 'u'
    monkeypatch.setenv('JWT_ISSUER', 'pathsgames-alpha-java')
    assert fresh.verify_access_token(token) is None
    monkeypatch.delenv('JWT_ISSUER')
    refresh = fresh.generate_refresh_token('u')
    assert fresh.decode_refresh_token(refresh)['sub'] == 'u'
    monkeypatch.setenv('JWT_AUDIENCE', 'other')
    assert fresh.decode_refresh_token(refresh) is None


def test_fake_tokens_and_the_google_path(monkeypatch):
    monkeypatch.setenv('ENV', 'dev')
    token = fake(expOffsetSeconds='120', iatOffsetSeconds=-5)
    c = google_verifier.verify(token)
    assert c['sub'] == 'sub-1' and c['aud'] == CLIENT and c['email_verified'] and c['exp'] > c['iat']
    other = google_verifier.verify(google_verifier.mint_fake({'sub': 's', 'aud': ['x'], 'expOffsetSeconds': 'x'}))
    assert other['aud'] == 'x'
    with pytest.raises(google_verifier.VerifyError):
        google_verifier.verify(google_verifier.mint_fake({'sub': 's', 'expOffsetSeconds': -120}))
    with pytest.raises(google_verifier.VerifyError):
        google_verifier.verify('')
    assert not google_verifier.is_fake(None) and not google_verifier.is_fake('garbage')
    monkeypatch.setenv('ENV', 'prod')
    with pytest.raises(google_verifier.VerifyError) as e:
        google_verifier.verify(token)
    assert e.value.code == 'INVALID_TOKEN'
    with pytest.raises(google_verifier.VerifyError):
        google_verifier.mint_fake({})
    assert len(google_verifier.fake_key('x' * 32)) == 32


def test_google_rs256_with_the_cached_jwks(monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwks = MagicMock()
    jwks.get_signing_key_from_jwt.return_value = SimpleNamespace(key=private.public_key())
    monkeypatch.setattr(google_verifier, '_JWKS', jwks)
    now = int(time.time())
    good = {'iss': 'https://accounts.google.com', 'aud': CLIENT, 'sub': 's', 'exp': now + 600, 'iat': now}
    token = jwt.encode(good, private, algorithm='RS256', headers={'kid': 'g'})
    assert google_verifier.verify(token)['sub'] == 's'
    with pytest.raises(google_verifier.VerifyError):
        google_verifier.verify(jwt.encode(dict(good, aud='x'), private, algorithm='RS256', headers={'kid': 'g'}))
    jwks.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientConnectionError('down')
    with pytest.raises(google_verifier.VerifyError) as e:
        google_verifier.verify(token)
    assert e.value.code == 'PROVIDER_UNAVAILABLE'
    jwks.get_signing_key_from_jwt.side_effect = jwt.DecodeError('bad')
    with pytest.raises(google_verifier.VerifyError):
        google_verifier.verify(token)
    monkeypatch.setattr(google_verifier, '_JWKS', None)
    assert isinstance(google_verifier._jwks(), jwt.PyJWKClient)


def test_client_id_and_switch(monkeypatch):
    monkeypatch.setenv('GOOGLE_CLIENT_ID', 'stage-client')
    monkeypatch.setenv('GOOGLE_ENABLED', 'false')
    assert google_verifier.client_id() == 'stage-client' and google_verifier.enabled() is False


# ── login ───────────────────────────────────────────────────────────────────

def test_login_creates_the_user_with_its_items(mem):
    mem.put_item({'PK': 'NICK#mario.rossi', 'SK': 'METADATA', 'counter': 1})
    result = login(mem)
    data = body(result)
    assert result['statusCode'] == 200, data
    assert data['nickname'] == 'mario.rossi#2' and data['displayName'] == 'Mario Rossi'
    assert data['accountType'] == 'GOOGLE' and data['newUser'] is True and data['csrfToken']
    user = mem.get_item(f"USER#{data['userUuid']}")
    assert user['email'] == 'mario.rossi+x@gmail.com' and user['GSI2_PK'] == 'GOOGLE_USER_LIST'
    assert mem.get_item('EMAIL#mario.rossi+x@gmail.com')['provider_subject'] == 'sub-1'
    assert mem.get_item('IDENTITY#GOOGLE#sub-1', 'EMAIL#mario.rossi+x@gmail.com')['given_name'] == 'Mario'
    refresh = [c for c in result['cookies'] if c.startswith('pathsgames.refreshToken=')][0]
    token = refresh.split(';')[0].split('=', 1)[1]
    assert mem.get_item(f'REFRESH#{auth_tokens.sha256(token)}')['user_uuid'] == data['userUuid']


def test_login_refusals_write_nothing(mem):
    cases = [(fake(email_verified=False), 'EMAIL_NOT_VERIFIED'),
             (fake(email='a@googlemail.com'), 'EMAIL_DOMAIN_NOT_ALLOWED'),
             (fake(email='@gmail.com'), 'EMAIL_DOMAIN_NOT_ALLOWED'),
             (fake(aud='other'), 'INVALID_TOKEN'), (fake(iss='evil'), 'INVALID_TOKEN'),
             (fake(sub=''), 'INVALID_TOKEN'), (fake(nonce='other'), 'INVALID_NONCE')]
    for token, code in cases:
        result = login(mem, token)
        assert body(result)['error'] == code, code
    assert not [k for k in mem.items if k[0].startswith(('USER#', 'EMAIL#', 'GOOGLEJTI#'))]
    from auth.handler import lambda_handler
    missing = lambda_handler(make_event('POST', '/api/auth/google', body='not json'), {})
    assert body(missing)['error'] == 'INVALID_REQUEST'


def test_login_replay_mismatch_and_states(mem):
    token = fake()
    assert login(mem, token)['statusCode'] == 200
    assert body(login(mem, token))['error'] == 'TOKEN_REPLAYED'
    result = login(mem, fake(sub='sub-other'))
    assert result['statusCode'] == 409 and body(result)['error'] == 'IDENTITY_MISMATCH'
    uuid = mem.get_item('EMAIL#mario.rossi+x@gmail.com')['user_uuid']
    mem.update_attributes(f'USER#{uuid}', 'METADATA', {'state': 7})
    assert body(login(mem))['error'] == 'ACCOUNT_DELETION_IN_PROGRESS'
    mem.update_attributes(f'USER#{uuid}', 'METADATA', {'state': 4})
    assert body(login(mem))['error'] == 'ACCOUNT_DISABLED'


def test_login_known_user_imported_email_and_dangling_pointer(mem):
    first = body(login(mem))
    again = body(login(mem))
    assert again['newUser'] is False and again['userUuid'] == first['userUuid']
    mem.put_item({'PK': 'USER#imp', 'SK': 'METADATA', 'uuid': 'imp', 'username': 'old', 'state': 2})
    mem.put_item({'PK': 'EMAIL#luigi@gmail.com', 'SK': 'METADATA', 'user_uuid': 'imp'})
    linked = body(login(mem, fake(email='luigi@gmail.com', sub='sub-l')))
    assert linked['userUuid'] == 'imp' and mem.get_item('EMAIL#luigi@gmail.com')['provider_subject'] == 'sub-l'
    mem.put_item({'PK': 'EMAIL#gone@gmail.com', 'SK': 'METADATA', 'user_uuid': 'ghost'})
    assert body(login(mem, fake(email='gone@gmail.com', sub='sub-g')))['newUser'] is True


def test_login_disabled_rate_limited_and_concurrent(mem, monkeypatch):
    monkeypatch.setenv('GOOGLE_ENABLED', 'false')
    assert body(login(mem))['error'] == 'GOOGLE_DISABLED'
    monkeypatch.setenv('GOOGLE_ENABLED', 'true')
    with patch.object(sso, '_create_google_user', return_value=None):
        assert body(login(mem))['error'] == 'INVALID_REQUEST'
    from common import security_utils
    monkeypatch.setenv('RATE_LIMIT_GOOGLE_PER_IP', '1')
    verdict = SimpleNamespace(allowed=False, retry_after_seconds=5, limit=1, remaining=0)
    with patch.object(security_utils, 'rate_limit', return_value=verdict):
        assert login(mem)['statusCode'] == 429


def test_login_merges_the_guest(mem):
    from auth.handler import lambda_handler
    guest_res = lambda_handler(make_event('POST', '/api/auth/guest'), {})
    guest = body(guest_res)
    gid = guest['userUuid']
    target = body(login(mem, fake(sub='sub-t', email='t@gmail.com')))
    tid = target['userUuid']
    for uid, muuid, ts in ((gid, 'mg', 200), (tid, 'mt', 100)):
        mem.put_item({'PK': f'MATCH#{muuid}', 'SK': 'METADATA', 'uuid': muuid, 'storyUuid': 's1', 'status': 'RUNNING',
                      'userCreatorUuid': uid, 'ts_update': ts, 'GSI1_PK': f'USER_MATCHES#{uid}', 'GSI1_SK': muuid})
    mem.put_item({'PK': 'MATCH#mg', 'SK': 'CHARACTER#1', 'userUuid': gid})
    merged = login(mem, fake(sub='sub-t', email='t@gmail.com'),
                   headers={'Authorization': f"Bearer {guest['accessToken']}"})
    data = body(merged)
    assert data['mergedGuest'] is True and data['cancelledMatches'] == 1
    # v1.7.0 step 9 — the Google user's active match wins even over a newer guest match
    assert data['cancelledMatchUuids'] == ['mg']
    assert mem.get_item('MATCH#mg')['userCreatorUuid'] == tid and mem.get_item('MATCH#mg')['status'] == 'CANCELLED'
    assert mem.get_item('MATCH#mt')['status'] == 'RUNNING'
    assert mem.get_item('MATCH#mg', 'CHARACTER#1')['userUuid'] == tid
    assert mem.get_item(f'USER#{gid}') is None
    assert any(c.startswith('pathsgames.guestcookie=;') for c in merged['cookies'])


def test_login_merges_the_guest_of_the_cookie(mem):
    from auth.handler import lambda_handler
    created = lambda_handler(make_event('POST', '/api/auth/guest'), {})
    cookie = [c for c in created['cookies'] if c.startswith('pathsgames.guestcookie=')][0].split(';')[0]
    data = body(login(mem, cookies=[cookie]))
    assert data['mergedGuest'] is True


# ── sessions ────────────────────────────────────────────────────────────────

def _cookie(result, name):
    return [c for c in result['cookies'] if c.startswith(name)][0].split(';')[0]


def test_refresh_rotation_grace_and_session_revoked(mem):
    from auth.handler import lambda_handler
    session = login(mem)
    refresh_cookie = _cookie(session, 'pathsgames.refreshToken=')
    event = make_event('POST', '/api/auth/refresh', cookies=[refresh_cookie])
    first = lambda_handler(event, {})
    assert first['statusCode'] == 200 and body(first)['role'] == 'PLAYER'
    assert lambda_handler(event, {})['statusCode'] == 200  # inside the 30 s grace
    item = auth_tokens.find_refresh(refresh_cookie.split('=', 1)[1])
    mem.update_attributes(item['PK'], 'METADATA', {'ts_rotated': 0})
    revoked = lambda_handler(event, {})
    assert revoked['statusCode'] == 401 and body(revoked)['error'] == 'SESSION_REVOKED'
    bad = lambda_handler(make_event('POST', '/api/auth/refresh', cookies=['pathsgames.refreshToken=x.y.z']), {})
    assert body(bad)['error'] == 'INVALID_REFRESH_TOKEN'


def test_refresh_edges(mem, monkeypatch):
    assert sso.refresh(None) is None
    assert sso.refresh('MOCK_REFRESH_x') is None
    monkeypatch.setattr(jwt_utils, 'ALLOW_MOCK_ACCESS', True)
    assert sso.refresh('MOCK_REFRESH_x') is None
    mem.put_item({'PK': f"REFRESH#{auth_tokens.sha256('MOCK_REFRESH_old')}", 'SK': 'METADATA', 'user_uuid': 'u',
                  'expires_at': 1})
    assert sso.refresh('MOCK_REFRESH_old') is None
    mem.put_item({'PK': f"REFRESH#{auth_tokens.sha256('MOCK_REFRESH_ok')}", 'SK': 'METADATA', 'user_uuid': 'gone'})
    assert sso.refresh('MOCK_REFRESH_ok') is None
    mem.put_item({'PK': 'USER#b', 'SK': 'METADATA', 'uuid': 'b', 'state': 3})
    mem.put_item({'PK': f"REFRESH#{auth_tokens.sha256('MOCK_REFRESH_b')}", 'SK': 'METADATA', 'user_uuid': 'b'})
    with pytest.raises(sso.AuthError) as e:
        sso.refresh('MOCK_REFRESH_b')
    assert e.value.code == 'ACCOUNT_DISABLED'


def test_session_cap_logout_and_logout_all(mem):
    from auth.handler import lambda_handler
    sessions = [login(mem, fake()) for _ in range(13)]
    uuid = body(sessions[0])['userUuid']
    assert len(auth_tokens.active_sessions(uuid)) == 12
    bearer = {'Authorization': f"Bearer {body(sessions[-1])['accessToken']}"}
    out = lambda_handler(make_event('POST', '/api/auth/logout', headers=bearer,
                                    cookies=[_cookie(sessions[-1], 'pathsgames.refreshToken=')]), {})
    assert out['statusCode'] == 200 and len(auth_tokens.active_sessions(uuid)) == 11
    assert auth_tokens.revoke(None) is False
    lambda_handler(make_event('POST', '/api/auth/logout/all', headers=bearer), {})
    assert auth_tokens.active_sessions(uuid) == []


def test_guest_cookie_lazy_migration(mem):
    mem.put_item({'PK': 'USER#g', 'SK': 'METADATA', 'uuid': 'g', 'state': 6, 'username': 'guest_g',
                  'guest_token': 'clear', 'GSI1_PK': 'GUEST_TOKEN#clear', 'summary': {'guest_token': 'clear'}})
    row = auth_tokens.guest_by_cookie('clear')
    assert row['uuid'] == 'g'
    stored = mem.get_item('USER#g')
    assert stored['guest_token'] == auth_tokens.sha256('clear') == stored['summary']['guest_token']
    assert auth_tokens.guest_by_cookie('clear')['uuid'] == 'g'
    assert auth_tokens.guest_by_cookie(None) is None and auth_tokens.guest_by_cookie('nope') is None
    mem.put_item({'PK': 'USER#h', 'SK': 'METADATA', 'uuid': 'h', 'GSI1_PK': 'GUEST_TOKEN#plain'})
    assert auth_tokens.guest_by_cookie('plain')['uuid'] == 'h'
    assert auth_tokens.legacy('c', auth_tokens.LEGACY_FALLBACK_UNTIL_S + 1) is None
    assert auth_tokens.sha256(None) is None


def test_resume_guest_by_hash(mem):
    from auth.handler import lambda_handler
    created = lambda_handler(make_event('POST', '/api/auth/guest'), {})
    cookie = _cookie(created, 'pathsgames.guestcookie=')
    assert mem.get_item(f"USER#{body(created)['userUuid']}")['guest_token'] != cookie.split('=', 1)[1]
    resumed = lambda_handler(make_event('POST', '/api/auth/guest/resume', cookies=[cookie]), {})
    assert resumed['statusCode'] == 200


# ── the requesting user and /me ─────────────────────────────────────────────

def test_resolve_user_and_me(mem):
    from auth.handler import lambda_handler
    data = body(login(mem))
    headers = {'Authorization': f"Bearer {data['accessToken']}"}
    me = body(lambda_handler(make_event('GET', '/api/auth/me', headers=headers), {}))
    assert me['displayName'] == 'Mario Rossi' and me['accountType'] == 'GOOGLE' and me['csrfToken']
    mem.update_attributes(f"USER#{data['userUuid']}", 'METADATA', {'state': 7})
    refused = lambda_handler(make_event('GET', '/api/auth/me', headers=headers), {})
    assert refused['statusCode'] == 403 and body(refused)['error'] == 'ACCOUNT_DELETION_IN_PROGRESS'
    assert sso.resolve_user('garbage')[1][0] == 401
    mem.put_item({'PK': 'USER#adm', 'SK': 'METADATA', 'uuid': 'adm', 'role': 'ADMIN'})
    assert sso.profile(mem.get_item('USER#adm'))['accountType'] == 'INTERNAL'
    assert sso.profile({'uuid': 'g', 'is_guest': True, 'nickname': 'g'})['accountType'] == 'GUEST'
    assert sso.display_name({'profile_name': ' Full '}, 'n') == 'Full' and sso.display_name({}, 'n') == 'n'


# ── deletion and jobs ───────────────────────────────────────────────────────

def test_delete_me_and_the_deletion_job(mem):
    from auth.handler import lambda_handler
    data = body(login(mem))
    uuid = data['userUuid']
    mem.put_item({'PK': 'MATCH#m1', 'SK': 'METADATA', 'GSI1_PK': f'USER_MATCHES#{uuid}', 'GSI1_SK': 'm1'})
    mem.put_item({'PK': 'MATCH#m1', 'SK': 'LOG#1'})
    headers = {'Authorization': f"Bearer {data['accessToken']}"}
    no_token = lambda_handler(make_event('DELETE', '/api/auth/me', headers=headers), {})
    assert body(no_token)['error'] == 'FRESH_TOKEN_REQUIRED'
    stale = lambda_handler(make_event('DELETE', '/api/auth/me', headers=headers,
                                      body={'idToken': fake(iatOffsetSeconds=-600)}), {})
    assert body(stale)['error'] == 'FRESH_TOKEN_REQUIRED'
    other = lambda_handler(make_event('DELETE', '/api/auth/me', headers=headers,
                                      body={'idToken': fake(sub='zzz')}), {})
    assert body(other)['error'] == 'IDENTITY_MISMATCH'
    fresh = fake()
    accepted = lambda_handler(make_event('DELETE', '/api/auth/me', headers=headers,
                                         body={'idToken': fresh, 'nonce': 'n'}), {})
    assert accepted['statusCode'] == 202 and body(accepted)['status'] == 'DELETING'
    assert body(login(mem))['error'] == 'ACCOUNT_DELETION_IN_PROGRESS'
    assert sso.run_deletion_job() == 1
    assert mem.get_item(f'USER#{uuid}') is None and mem.get_item('MATCH#m1', 'LOG#1') is None
    assert mem.get_item('EMAIL#mario.rossi+x@gmail.com') is None
    assert body(login(mem))['newUser'] is True


def test_delete_me_refusals(mem):
    user = {'PK': 'USER#adm', 'SK': 'METADATA', 'uuid': 'adm', 'role': 'ADMIN', 'state': 2}
    with pytest.raises(sso.AuthError) as e:
        sso.request_deletion(user, 'x', None)
    assert e.value.code == 'NOT_A_GOOGLE_ACCOUNT'
    data = body(login(mem))
    user = mem.get_item(f"USER#{data['userUuid']}")
    token = fake()
    sso.request_deletion(dict(user), token, None)
    with pytest.raises(sso.AuthError) as e:
        sso.request_deletion(dict(user), token, None)
    assert e.value.code == 'TOKEN_REPLAYED'


def test_retention_and_scheduled_jobs(mem, monkeypatch):
    data = body(login(mem))
    uuid = data['userUuid']
    mem.update_attributes(f'USER#{uuid}', 'METADATA', {'ts_last_access': 1, 'ts_registration': 1,
                                                        'GSI2_SK': f'{1:013d}#{uuid}'})
    fresh = int(time.time() * 1000)
    mem.put_item({'PK': 'USER#fresh', 'SK': 'METADATA', 'uuid': 'fresh', 'GSI2_PK': 'GOOGLE_USER_LIST',
                  'GSI2_SK': f'{fresh:013d}#fresh', 'ts_last_access': fresh, 'email': 'f@gmail.com'})
    # v1.7.0 an ADMIN in the list is never retired
    mem.put_item({'PK': 'USER#adm', 'SK': 'METADATA', 'uuid': 'adm', 'GSI2_PK': 'GOOGLE_USER_LIST', 'role': 'ADMIN',
                  'GSI2_SK': f'{2:013d}#adm', 'ts_last_access': 2})
    from auth.handler import scheduled_account_jobs
    assert scheduled_account_jobs({'job': 'retention'}, None) == {'status': 'OK', 'retired': 1}
    assert mem.get_item(f'USER#{uuid}')['state'] == 7
    assert scheduled_account_jobs({}, None) == {'status': 'OK', 'deleted': 1}
    assert sso.retire_inactive_users(24, 0) == 0


def test_matches_to_cancel_keeps_ended():
    rows = [{'uuid': 'a', 'storyUuid': 's', 'status': 'ENDED'}, {'uuid': 'b', 'storyUuid': 's', 'status': 'RUNNING'}]
    assert sso.matches_to_cancel([], rows) == []
    assert sso.language('fr', 'it-IT') == 'it' and sso.language(None, 'de') == 'en' and sso.language('EN', None) == 'en'
    assert sso.nickname_base('+x@gmail.com') == 'player'


# ── admin bootstrap and dev endpoints ───────────────────────────────────────

def test_create_admin_and_its_lambda(mem, monkeypatch):
    monkeypatch.setenv('ADMIN_TOKEN_DAYS', '30')
    first = sso.create_admin('owner')
    assert first['created'] and first['role'] == 'ADMIN'
    claims = jwt_utils.verify_access_token(first['accessToken'])
    assert claims['uuid'] == first['userUuid']
    assert sso.create_admin('owner')['created'] is False
    with pytest.raises(sso.AuthError):
        sso.create_admin('a b')
    monkeypatch.setenv('ADMIN_TOKEN_DAYS', 'x')
    assert sso.admin_token_days() == 365
    from admin_bootstrap.handler import lambda_handler
    assert lambda_handler({'nickname': 'ops'}, None)['nickname'] == 'ops'
    assert lambda_handler({'nickname': '?'}, None)['error'] == 'INVALID_REQUEST'
    with patch.object(jwt_utils, 'misconfigured', return_value=True):
        assert lambda_handler({}, None)['error'] == 'MISCONFIGURED'
    mem.put_item({'PK': 'ADMIN#dangling', 'SK': 'METADATA', 'user_uuid': 'nobody'})
    assert sso.create_admin('dangling')['created'] is True
    mem.put_item({'PK': 'NICKNAME#taken', 'SK': 'METADATA', 'user_uuid': 'someone'})
    with pytest.raises(sso.AuthError) as taken:
        sso.create_admin('taken')
    assert taken.value.code == 'NICKNAME_TAKEN' and mem.get_item('ADMIN#taken') is None


def test_allocate_nickname_claims_one_user_per_nickname(mem, monkeypatch):
    assert sso.allocate_nickname('mario', 'u-1') == 'mario'
    assert mem.get_item('NICKNAME#mario')['user_uuid'] == 'u-1'
    mem.put_item({'PK': 'NICKNAME#mario#2', 'SK': 'METADATA', 'user_uuid': 'admin'})
    assert sso.allocate_nickname('mario', 'u-2') == 'mario#3'
    monkeypatch.setattr(db_utils, 'increment_counter', lambda *a, **k: None)
    random_suffix = sso.allocate_nickname('mario', 'u-3')
    assert random_suffix.startswith('mario#') and mem.get_item(f'NICKNAME#{random_suffix}')['user_uuid'] == 'u-3'
    monkeypatch.setattr(db_utils, 'put_item_if_absent', lambda item: False)
    assert sso.allocate_nickname('mario', 'abcdef12-0000') == 'mario#abcdef12'


def test_deletion_releases_the_nickname(mem):
    uuid = body(login(mem))['userUuid']
    nickname = mem.get_item(f'USER#{uuid}')['nickname']
    assert mem.get_item(f'NICKNAME#{nickname}')['user_uuid'] == uuid
    sso.delete_user_fully(uuid)
    assert mem.get_item(f'NICKNAME#{nickname}') is None


def test_dev_endpoints(mem):
    from seed.handler import lambda_handler
    admin = lambda_handler(make_event('POST', '/api/dev/admin-token'), {})
    assert admin['statusCode'] == 201 and body(admin)['nickname'] == 'robot_admin'
    bad = lambda_handler(make_event('POST', '/api/dev/admin-token', body={'nickname': '!'}), {})
    assert bad['statusCode'] == 400
    token = body(lambda_handler(make_event('POST', '/api/dev/google-token', body={'sub': 's'}), {}))['idToken']
    assert google_verifier.verify(token)['sub'] == 's'
    weird = lambda_handler(make_event('POST', '/api/dev/google-token', body='[1]'), {})
    assert weird['statusCode'] == 200
    assert body(lambda_handler(make_event('POST', '/api/dev/jobs/account-deletion'), {})) == {'deletedUsers': 0}


def test_cleanup_removes_robot_google_users(mem):
    mem.put_item({'PK': 'USER#r', 'SK': 'METADATA', 'uuid': 'r', 'GSI2_PK': 'GOOGLE_USER_LIST',
                  'summary': {'nickname': 'robottest.x'}})
    from seed.handler import _robot_google_users
    assert [r['uuid'] for r in _robot_google_users()] == ['r']


def test_echo_exposes_google(monkeypatch):
    monkeypatch.setenv('GOOGLE_CLIENT_ID', 'c')
    from echo.handler import lambda_handler
    data = body(lambda_handler(make_event('GET', '/api/echo/status'), {}))
    assert data['googleEnabled'] is True and data['googleClientId'] == 'c'


# ── export / import identities ──────────────────────────────────────────────

def test_export_import_identity_items(mem):
    from match import match_export, neutral
    login(mem)
    uuid = mem.get_item('EMAIL#mario.rossi+x@gmail.com')['user_uuid']
    section = neutral.user_section(mem.get_item(f'USER#{uuid}'), sso.identities_of(uuid))
    assert section['identities'][0]['subject'] == 'sub-1'
    moved = dict(section, uuid='new-uuid', identities=[dict(section['identities'][0], email='mover@gmail.com')])
    match_export._write_user(moved, 5)
    assert mem.get_item('EMAIL#mover@gmail.com')['provider_subject'] == 'sub-1'
    assert mem.get_item('IDENTITY#GOOGLE#sub-1', 'EMAIL#mover@gmail.com')['user_uuid'] == 'new-uuid'
    assert mem.get_item('USER#new-uuid')['nickname'] == 'mario.rossi#2'
    analysis = SimpleNamespace(doc={'users': [dict(moved, uuid='x2', identities=[dict(moved['identities'][0],
                                                                                         subject='other')])],
                                    'story': {}, 'match': {}}, users=[], errors=[], warnings=[], story_action=None,
                               active_matches=[])
    match_export._users(analysis)
    assert analysis.errors[0]['code'] == 'IDENTITY_MISMATCH'
    plain = match_export._user_item({'uuid': 'p', 'username': 'u', 'emailAddress': 'P@X.org'}, 1)
    assert plain['email'] == 'p@x.org' and 'GSI2_PK' not in plain
    match_export._write_user({'uuid': 'q', 'username': 'u', 'emailAddress': 'q@x.org'}, 1)
    assert mem.get_item('EMAIL#q@x.org') == {'PK': 'EMAIL#q@x.org', 'SK': 'METADATA', 'user_uuid': 'q'}


# ── db_utils helpers and the sanitizer ──────────────────────────────────────

def test_db_utils_conditional_helpers(monkeypatch):
    table = MagicMock()
    monkeypatch.setattr(db_utils, '_table', table)
    assert db_utils.put_item_if_absent({'PK': 'A', 'SK': 'B'}) is True
    assert table.put_item.call_args.kwargs['ConditionExpression'] == 'attribute_not_exists(PK)'
    table.put_item.side_effect = ClientError({'Error': {'Code': 'ConditionalCheckFailedException'}}, 'PutItem')
    assert db_utils.put_item_if_absent({'PK': 'A'}) is False
    table.put_item.side_effect = ClientError({'Error': {'Code': 'Other'}}, 'PutItem')
    assert db_utils.put_item_if_absent({'PK': 'A'}) is False
    table.update_item.return_value = {'Attributes': {'counter': 3}}
    assert db_utils.increment_counter('NICK#x') == 3
    assert db_utils.update_attributes('P', 'S', {'a': 1, 'summary.b': 2}, remove=('GSI1_PK',)) is True
    expr = table.update_item.call_args.kwargs['UpdateExpression']
    assert expr.startswith('SET ') and 'REMOVE' in expr and '#s1_0.#s1_1' in expr
    assert db_utils.update_attributes('P') is True
    table.update_item.side_effect = ClientError({'Error': {'Code': 'X'}}, 'UpdateItem')
    assert db_utils.increment_counter('NICK#x') is None
    assert db_utils.update_attributes('P', 'S', remove=('x',)) is False


def test_aws_log_sanitizer():
    assert log_sanitizer.sanitize({'email': 'a@gmail.com', 'sub': 's'}) == {'email': log_sanitizer.REDACTED, 'sub': 's'}
    assert 'gmail' not in log_sanitizer.sanitize_text('user x@gmail.com')


def test_aws_log_sanitizer_filter_and_install():
    import logging
    record = logging.LogRecord('x', logging.INFO, 'f', 1, 'user %s given_name=Mario', ('x@gmail.com',), None)
    log_sanitizer.SanitizingFilter().filter(record)
    assert 'gmail' not in record.getMessage() and 'Mario' not in record.getMessage()
    broken = logging.LogRecord('x', logging.INFO, 'f', 1, 'broken %s %s', ('one',), None)
    log_sanitizer.SanitizingFilter().filter(broken)
    assert broken.getMessage() == 'broken %s %s'
    out = log_sanitizer.sanitize({'list': [{'picture': 'p'}, 3], 'note': 'to b@gmail.com'})
    assert out['list'][0]['picture'] == log_sanitizer.REDACTED and out['list'][1] == 3
    assert log_sanitizer.sanitize_text(None) is None
    logger = logging.getLogger('aws-sanitizer-test')
    handler = logging.StreamHandler()
    logger.addHandler(handler)
    log_sanitizer.install('aws-sanitizer-test')
    log_sanitizer.install('aws-sanitizer-test')
    assert sum(isinstance(f, log_sanitizer.SanitizingFilter) for f in handler.filters) == 1
    logger.removeHandler(handler)
