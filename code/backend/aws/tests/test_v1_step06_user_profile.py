"""V1 step 6 (1.7.0) on AWS: the request stamp and play time, the match summary map, the profile statistics
and preferences of /api/auth/me, the echo choices and the GSI readers that use the summary."""
import json
from unittest.mock import MagicMock, patch

import pytest

from helpers import make_event
from common import auth_tokens, db_utils, match_summary, profile, sso, story_index
from match import repo
from match import handler as h
from test_v1_google_sso import MemDb, body, fake, login  # noqa: F401  shared in-memory table
from test_v1_google_sso import mem  # noqa: F401  fixture

MATCH = 'm-1'
PK = f'MATCH#{MATCH}'


def _meta(**over):
    item = {'PK': PK, 'SK': 'METADATA', 'uuid': MATCH, 'storyUuid': 's', 'status': 'RUNNING', 'name': 'n',
            'currentClock': 3, 'userCreatorUuid': 'u', 'tsInsert': 1, 'traitUuids': None, 'ts_update': 1_000_000}
    item.update(over)
    return item


# ── summary ──────────────────────────────────────────────────────────────────

def test_summary_build_flatten_and_rebuild():
    item = _meta(playMs=5)
    s = match_summary.build(item)
    assert s['uuid'] == MATCH and s['traitUuids'] == [] and 'currentClock' not in s and 'playMs' not in s
    row = {'PK': PK, 'summary': s, 'currentClock': 4}
    flat = match_summary.flatten(row)
    assert flat['status'] == 'RUNNING' and flat['currentClock'] == 4 and 'summary' not in flat
    assert match_summary.flatten(None) is None
    assert 'summary' in match_summary.with_summary(dict(item))
    assert 'summary' not in match_summary.with_summary({'PK': 'USER#x', 'SK': 'METADATA'})
    assert h._summary_from_item(row)['currentClock'] == 4 and h._summary_from_item(row)['uuid'] == MATCH


# ── stamp ────────────────────────────────────────────────────────────────────

def test_the_request_stamp_is_one_value_until_cleared():
    db_utils.set_request_stamp(123)
    assert db_utils.stamp_ms() == 123
    db_utils.set_request_stamp(None)
    assert db_utils.stamp_ms() > 123


def test_put_item_stamps_with_the_request_stamp():
    table = MagicMock()
    with patch.object(db_utils, '_table', table):
        db_utils.set_request_stamp(777)
        try:
            item = {'PK': 'X', 'SK': 'METADATA'}
            assert db_utils.put_item(item) is True
            assert item['ts_update'] == 777 and item['ts_insert'] == 777
            other = {'PK': 'Y', 'SK': 'METADATA'}
            table.put_item.side_effect = None
            assert db_utils.put_item_if_absent(other) is True and other['ts_update'] == 777
        finally:
            db_utils.set_request_stamp(None)


@pytest.fixture
def table(monkeypatch):
    rows = {}

    def get_item(pk, sk='METADATA', consistent=True):
        it = rows.get((pk, sk))
        return dict(it) if it else None

    written = []
    monkeypatch.setattr(db_utils, 'get_item', get_item)
    monkeypatch.setattr(db_utils, 'batch_put_items', lambda items: written.extend(items) or True)
    monkeypatch.setattr(db_utils, 'put_item', lambda item: written.append(item) or True)
    updates = []
    monkeypatch.setattr(db_utils, 'update_attributes',
                        lambda pk, sk='METADATA', values=None, remove=(): updates.append((pk, values)) or True)
    rows[(PK, 'METADATA')] = _meta()
    return {'rows': rows, 'written': written, 'updates': updates}


@pytest.mark.parametrize('gap, expected', [(42_000, 42_000), (3_600_000, 300_000), (5_000, 5_000)])
def test_a_gameplay_claim_adds_the_capped_gap_and_flushes_the_summary(table, gap, expected):
    repo.begin()
    stamp = db_utils.stamp_ms()
    table['rows'][(PK, 'METADATA')]['ts_update'] = stamp - gap
    assert repo.claim(MATCH, 300_000) == str(stamp)
    assert repo.claim(MATCH, 300_000) == str(stamp)  # a second claim of the request adds nothing
    repo.flush()
    meta = table['written'][0]
    assert meta['playMs'] == expected and meta['summary']['status'] == 'RUNNING'
    assert db_utils._REQUEST_STAMP is None


def test_a_gameplay_claim_of_a_missing_or_blank_match(table):
    repo.begin()
    assert repo.claim('', 1) is None
    assert repo.claim('gone', 1) is None
    repo.flush()
    assert table['written'] == []


def test_an_admin_touch_bumps_ts_update_only(table):
    repo.begin()
    assert repo.touch(MATCH) is True
    assert table['updates'] == [(PK, {'ts_update': db_utils.stamp_ms()})]
    repo.save(repo.match(MATCH))
    assert repo.touch(MATCH) is True  # already queued: the flush stamps it
    assert len(table['updates']) == 1
    assert repo.touch('') is False
    repo.flush()
    assert 'playMs' not in table['written'][-1]


def test_a_save_outside_a_request_writes_the_summary(table):
    repo.save(_meta())
    assert table['written'][-1]['summary']['uuid'] == MATCH


def _event(method, path, status=200):
    return make_event(method, path), {'statusCode': status}


@pytest.mark.parametrize('method, path, gameplay', [
    ('POST', f'/api/matches/{MATCH}/start', True), ('POST', f'/api/matches/{MATCH}/join', True),
    ('POST', f'/api/gameplay/{MATCH}/action/pass', True), ('POST', f'/api/gameplay/{MATCH}/action/sleep', True),
    ('POST', f'/api/gameplay/{MATCH}/action/use-exp', True),
    ('POST', f'/api/gameplay/{MATCH}/action/execute-event', True),
    ('POST', f'/api/gameplay/{MATCH}/action/select-choice', True),
    ('POST', f'/api/gameplay/{MATCH}/inventory/use-item', True),
    ('POST', f'/api/gameplay/{MATCH}/inventory/drop-item', True),
    ('POST', f'/api/gameplay/{MATCH}/movements/start', True), ('PATCH', f'/api/match/{MATCH}/end/ev', True),
    ('POST', f'/api/admin/matches/{MATCH}/pause', False), ('POST', f'/api/admin/matches/{MATCH}/resume', False),
    ('POST', f'/api/admin/matches/{MATCH}/stop', False), ('PUT', f'/api/admin/matches/{MATCH}', False),
    ('PUT', f'/api/admin/matches/{MATCH}/owner', False), ('PUT', f'/api/admin/matches/{MATCH}/registry', False),
    ('DELETE', f'/api/admin/matches/{MATCH}/registry', False),
    ('POST', f'/api/admin/matches/{MATCH}/snapshots/s1/restore', False),
    ('POST', f'/api/admin/matches/{MATCH}/player/p1/changeStatistics', False)])
def test_every_write_route_stamps_on_success_only(method, path, gameplay):
    event, ok = _event(method, path)
    with patch.object(h._repo, 'touch') as touch, patch.object(h._repo, 'claim', return_value='9') as claim:
        h._stamp_match(event, ok)
        if gameplay:
            claim.assert_called_once_with(MATCH, 300_000, None)
            touch.assert_not_called()
        else:
            touch.assert_called_once_with(MATCH)
            claim.assert_not_called()
        touch.reset_mock()
        claim.reset_mock()
        h._stamp_match(event, {'statusCode': 409})
        h._stamp_match(event, None)
        touch.assert_not_called()
        claim.assert_not_called()


def test_reads_and_the_import_route_never_stamp(monkeypatch):
    with patch.object(h._repo, 'touch') as touch, patch.object(h._repo, 'claim') as claim:
        for method, path in (('GET', f'/api/match/{MATCH}/info'), ('POST', '/api/admin/matches/import'),
                             ('PUT', '/api/admin/matches/statuses'), ('DELETE', f'/api/admin/matches/{MATCH}')):
            h._stamp_match(*_event(method, path))
        touch.assert_not_called()
        claim.assert_not_called()
    monkeypatch.setenv('PLAY_TIME_CAP_SECONDS', '60')
    assert h.play_time_cap_ms() == 60_000
    monkeypatch.setenv('PLAY_TIME_CAP_SECONDS', 'x')
    assert h.play_time_cap_ms() == 300_000
    monkeypatch.setenv('PLAY_TIME_CAP_SECONDS', '0')
    assert h.play_time_cap_ms() == 300_000


def test_the_route_stamps_a_successful_write():
    with patch.object(h, '_dispatch', return_value={'statusCode': 200}), patch.object(h, '_stamp_match') as st, \
            patch.object(h._repo, 'flush'), patch.object(h._kpi, 'flush'):
        h._route(make_event('POST', f'/api/gameplay/{MATCH}/action/pass'), None)
        st.assert_called_once()


def test_statuses_and_snapshot_keys():
    assert 'BANNED' in h.MATCH_STATUSES and 'BANNED' in h.TERMINAL_STATUSES
    assert 'playMs' in h._snapshots._META_KEEP and 'playMs' in h._snapshots._META_SKIP


def test_admin_list_filters_read_the_summary():
    with patch.object(h.db_utils, 'query_index_page', return_value=([{'summary': {'uuid': 'x', 'status': 'ENDED'},
                                                                       'GSI2_PK': 'MATCH'}], None)) as q:
        res = h._list_all_matches({'queryStringParameters': {'status': 'ENDED'}})
    assert q.call_args.kwargs['eq_filters']['summary.status'] == 'ENDED'
    item = json.loads(res['body'])['items'][0]
    assert item['uuid'] == 'x' and item['status'] == 'ENDED' and item['currentClock'] == 0


# ── profile ──────────────────────────────────────────────────────────────────

def test_stats_count_only_the_played_statuses(mem):
    for i, (status, play, clock) in enumerate((('RUNNING', 100, 2), ('ENDED', 200, 5), ('GAMEOVER', 50, 1),
                                               ('CANCELLED', 999, 9), ('BANNED', 999, 9), ('CREATED', 0, 0))):
        mem.put_item({'PK': f'MATCH#{i}', 'SK': 'METADATA', 'GSI1_PK': 'USER_MATCHES#u', 'currentClock': clock,
                      'playMs': play, 'summary': {'status': status}})
    assert profile.stats('u') == {'matchesPlayed': 3, 'matchesCompleted': 1, 'matchesGameOver': 1,
                                  'playTimeMs': 350, 'clocksPlayed': 8}
    assert profile.stats(None)['matchesPlayed'] == 0
    assert profile._int('x') == 0


def test_lists_and_preferences(monkeypatch):
    assert profile.supported_languages() == ['en', 'it']
    monkeypatch.setenv('SUPPORTED_THEMES', ' Default, sepia ,,sepia')
    assert profile.supported_themes() == ['default', 'sepia']
    assert profile.preferences({'language': 'it', 'theme_selected': 'high-contrast'})['highContrast'] is True
    assert profile.preferences({})['theme'] == 'default'


def _me_headers(data, csrf=None):
    headers = {'Authorization': f"Bearer {data['accessToken']}"}
    if csrf:
        headers['X-CSRF-TOKEN'] = csrf
    return headers


def test_me_and_patch_me_for_a_google_user(mem):
    from auth.handler import lambda_handler
    data = body(login(mem))
    me = body(lambda_handler(make_event('GET', '/api/auth/me', headers=_me_headers(data)), {}))
    assert me['preferences']['theme'] == 'default' and me['stats']['matchesPlayed'] == 0
    res = lambda_handler(make_event('PATCH', '/api/auth/me', body={'language': 'en', 'highContrast': True},
                                    headers=_me_headers(data)), {})
    assert res['statusCode'] == 200, res['body']
    assert body(res)['preferences'] == {'language': 'en', 'theme': 'high-contrast', 'highContrast': True}
    user = mem.get_item(f"USER#{data['userUuid']}")
    assert user['language'] == 'en' and user['theme_selected'] == 'high-contrast'
    res = lambda_handler(make_event('PATCH', '/api/auth/me', body={'highContrast': False},
                                    headers=_me_headers(data)), {})
    assert body(res)['preferences']['theme'] == 'default'
    for payload in ({'language': 'fr'}, {'theme': 'neon'}, {}, {'language': 5}, {'highContrast': 'yes'}):
        res = lambda_handler(make_event('PATCH', '/api/auth/me', body=payload, headers=_me_headers(data)), {})
        assert res['statusCode'] == 400 and body(res)['error'] == 'INVALID_REQUEST', payload
    assert lambda_handler(make_event('PATCH', '/api/auth/me', body={}), {})['statusCode'] == 401


def test_patch_me_needs_the_csrf_header_when_enforced(mem, monkeypatch):
    from auth.handler import lambda_handler
    data = body(login(mem))
    monkeypatch.setenv('CSRF_ENFORCED', 'true')
    res = lambda_handler(make_event('PATCH', '/api/auth/me', body={'language': 'en'}, headers=_me_headers(data)), {})
    assert res['statusCode'] == 403 and body(res)['error'] == 'CSRF_TOKEN_MISSING'
    res = lambda_handler(make_event('PATCH', '/api/auth/me', body={'language': 'en'},
                                    headers=_me_headers(data, 'forged')), {})
    assert body(res)['error'] == 'CSRF_TOKEN_INVALID'
    res = lambda_handler(make_event('PATCH', '/api/auth/me', body={'language': 'en'},
                                    headers=_me_headers(data, data['csrfToken'])), {})
    assert res['statusCode'] == 200


def test_patch_me_refuses_a_guest():
    with pytest.raises(sso.AuthError) as e:
        profile.update_preferences({'uuid': 'g', 'state': 6}, 'en', None)
    assert e.value.code == 'GOOGLE_ACCOUNT_REQUIRED' and e.value.status == 403


def test_echo_exposes_the_choices(monkeypatch):
    from echo.handler import lambda_handler
    monkeypatch.setenv('SUPPORTED_LANGUAGES', 'en,it,fr')
    data = json.loads(lambda_handler(make_event('GET', '/api/echo/status'), None)['body'])
    assert data['supportedLanguages'] == ['en', 'it', 'fr'] and data['supportedThemes'] == ['default', 'high-contrast']


# ── GSI readers ──────────────────────────────────────────────────────────────

def test_guest_merge_keeps_the_summary_aligned(mem):
    mem.put_item({'PK': 'MATCH#g1', 'SK': 'METADATA', 'uuid': 'g1', 'storyUuid': 's', 'status': 'RUNNING',
                  'userCreatorUuid': 'guest', 'GSI1_PK': 'USER_MATCHES#guest', 'ts_update': 1})
    mem.put_item({'PK': 'MATCH#t1', 'SK': 'METADATA', 'uuid': 't1', 'storyUuid': 's', 'status': 'RUNNING',
                  'userCreatorUuid': 'target', 'GSI1_PK': 'USER_MATCHES#target', 'ts_update': 2})
    mem.put_item({'PK': 'MATCH#g2', 'SK': 'METADATA', 'uuid': 'g2', 'storyUuid': 'z', 'status': 'ENDED',
                  'userCreatorUuid': 'guest', 'GSI1_PK': 'USER_MATCHES#guest', 'ts_update': 1})
    with patch.object(auth_tokens, 'revoke_all'):
        cancelled = sso.merge_guest({'uuid': 'guest'}, 'target')
    assert [m['uuid'] for m in cancelled] == ['g1']
    g1, g2 = mem.get_item('MATCH#g1'), mem.get_item('MATCH#g2')
    assert g1['summary']['status'] == 'CANCELLED' and g1['summary']['userCreatorUuid'] == 'target'
    assert g2['summary']['status'] == 'ENDED' and g2['summary']['userCreatorUuid'] == 'target'
    assert mem.get_item('MATCH#t1').get('summary') is None


def test_a_guest_resumed_from_its_gsi1_row_gets_its_uuid(mem):
    mem.put_item({'PK': 'USER#g-1', 'SK': 'METADATA', 'GSI1_PK': f"GUEST_TOKEN#{auth_tokens.sha256('c')}",
                  'summary': {'username': 'guest_g'}})
    row = auth_tokens.guest_by_cookie('c')
    assert row['uuid'] == 'g-1' and row['username'] == 'guest_g'


def test_a_story_index_row_gets_its_uuid_from_the_key():
    row = story_index.lift({'GSI2_SK': 'STORY#s-9', 'summary': {'meta': {'id': 9}}})
    assert row['uuid'] == 's-9' and row['id'] == 9
    assert story_index.lift({'uuid': 'kept', 'GSI2_SK': 'STORY#other'})['uuid'] == 'kept'
