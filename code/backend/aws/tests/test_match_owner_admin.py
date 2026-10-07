"""v0.41.6 — admin User tab on AWS: GET/PUT /api/admin/matches/{uuid}/owner (routing before the PUT
catch-all, METADATA userCreatorUuid + GSI1_PK, every CHARACTER userUuid, log row, refusals), the auth
GET /api/admin/users/{identifier}, and the current owner on snapshot check, restore and export."""
import json
from contextlib import contextmanager
from unittest.mock import patch

from match import handler as h
from match import repo
from match import snapshots as snap
from helpers import FakeTable, admin_event, make_event, patch_table
from test_step41_snapshots import ADMIN, ADMIN_TOKEN, PK, PLAYER, MATCH_UUID, _char, _match, _story

PLAYER_TOKEN = {'Authorization': 'Bearer player'}
OWNER = f'/api/admin/matches/{MATCH_UUID}/owner'
B_UUID = '11111111-2222-3333-4444-555555555555'
FUTURE = 9_999_999_999_000
BOB = {'PK': f'USER#{B_UUID}', 'SK': 'METADATA', 'uuid': B_UUID, 'username': 'bob', 'role': 'PLAYER',
       'state': 6, 'is_guest': True, 'guest_expires_at': FUTURE}


def _body(result):
    return json.loads(result['body'])


def _claims(token):
    return {'uuid': 'admin-uuid-001' if token == 'admin' else 'player-uuid-001'}


@contextmanager
def _env(items):
    table = FakeTable([PLAYER, ADMIN, *items])

    def gsi(index, pk, sk_prefix=None):
        return [dict(v) for v in table.store.values() if v.get('GSI1_PK') == pk]

    with patch('match.handler.jwt_utils.verify_access_token', side_effect=_claims), \
            patch('match.handler.db_utils.query_gsi', side_effect=gsi), patch_table(table):
        yield table


def _call(method, path=OWNER, body=None, headers=ADMIN_TOKEN):
    return h.lambda_handler(make_event(method, path, body=body, headers=dict(headers),
                                       path_params={'uuidMatch': MATCH_UUID}), None)


def _seed(*extra):
    return [_story(), _match(), _char(), BOB, *extra]


# ── GET owner ────────────────────────────────────────────────────────────────

def test_get_owner_answers_the_creator():
    with _env(_seed()):
        result = _call('GET')
    body = _body(result)
    assert result['statusCode'] == 200
    assert body['uuid'] == 'player-uuid-001' and body['username'] == 'player'
    assert body['matchCount'] == 1 and body['eligible'] is True and body['guest'] is False


def test_get_owner_errors_and_admin_gate():
    with _env([_story(), _match(userCreatorUuid='gone'), _char()]):
        gone = _call('GET')
        player = _call('GET', headers=PLAYER_TOKEN)
        unknown = h.lambda_handler(make_event('GET', '/api/admin/matches/x/owner', headers=dict(ADMIN_TOKEN),
                                              path_params={'uuidMatch': 'x'}), None)
    assert gone['statusCode'] == 404 and _body(gone)['error'] == 'USER_NOT_FOUND'
    assert player['statusCode'] == 403
    assert unknown['statusCode'] == 404 and _body(unknown)['error'] == 'MATCH_NOT_FOUND'


# ── PUT owner ────────────────────────────────────────────────────────────────

def test_move_rewrites_metadata_characters_and_logs():
    with _env(_seed()) as table:
        result = _call('PUT', body={'user': 'bob'})
        meta = table.get_item(PK)
        c1 = table.get_item(PK, 'CHARACTER#c1')
        logs = table.logs(MATCH_UUID)
    body = _body(result)
    assert result['statusCode'] == 200
    assert body == {'status': 'MOVED', 'matchUuid': MATCH_UUID,
                    'previousOwner': {'uuid': 'player-uuid-001', 'username': 'player'},
                    'owner': {'uuid': B_UUID, 'username': 'bob'}, 'charactersMoved': 1}
    assert meta['userCreatorUuid'] == B_UUID and meta['GSI1_PK'] == f'USER_MATCHES#{B_UUID}'
    assert meta['GSI1_SK'] == 'MATCH#1#m1' and meta['status'] == 'RUNNING'
    assert c1['userUuid'] == B_UUID
    assert [(r['type'], r['message']) for r in logs] == [
        ('ADMIN_ACTION', f'OWNER_CHANGED from=player/player-uuid-001 to=bob/{B_UUID}')]


def test_same_owner_is_unchanged_and_writes_nothing():
    with _env(_seed()) as table:
        _call('PUT', body={'user': B_UUID})
        count = len(table.logs(MATCH_UUID))
        again = _call('PUT', body={'user': 'bob'})
        after = len(table.logs(MATCH_UUID))
    assert _body(again)['status'] == 'UNCHANGED' and _body(again)['charactersMoved'] == 0
    assert count == after == 1


def test_a_half_written_move_is_repaired():
    meta = _match(userCreatorUuid=B_UUID, GSI1_PK=f'USER_MATCHES#{B_UUID}')
    with _env([_story(), meta, _char(), BOB]) as table:
        result = _call('PUT', body={'user': 'bob'})
        c1 = table.get_item(PK, 'CHARACTER#c1')
    assert _body(result)['status'] == 'MOVED' and c1['userUuid'] == B_UUID


def test_bad_bodies_are_400():
    with _env(_seed()):
        results = [_call('PUT', body=b) for b in ({}, {'user': ' '}, {'user': 5}, [1])]
        broken = h.lambda_handler({**make_event('PUT', OWNER, headers=dict(ADMIN_TOKEN),
                                                path_params={'uuidMatch': MATCH_UUID}), 'body': '{x'}, None)
    for r in results + [broken]:
        assert r['statusCode'] == 400 and _body(r)['error'] == 'INVALID_INPUT'


def _code(items, user, status=409):
    with _env(items):
        result = _call('PUT', body={'user': user})
    assert result['statusCode'] == status, result
    return _body(result)['error']


def test_refusals_in_order():
    assert _code([_story(), _char(), BOB], 'bob', 404) == 'MATCH_NOT_FOUND'
    assert _code(_seed(), 'ghost', 404) == 'USER_NOT_FOUND'
    twins = [{**BOB, 'PK': 'USER#t1', 'uuid': 't1', 'username': 'twin'},
             {**BOB, 'PK': 'USER#t2', 'uuid': 't2', 'username': 'twin'}]
    assert _code(_seed(*twins), 'twin') == 'USER_AMBIGUOUS'
    assert _code([_story(), _match(status='ENDED'), _char(), BOB], 'bob') == 'MATCH_TERMINATED'
    assert _code(_seed(_char('c2', 2, userUuid='x')), 'bob') == 'MATCH_MULTI_CHARACTER'
    assert _code(_seed(), 'admin') == 'USER_NOT_ALLOWED'
    blocked = {**BOB, 'PK': 'USER#k', 'uuid': 'k', 'username': 'kim', 'state': 3}
    assert _code(_seed(blocked), 'kim') == 'USER_NOT_ALLOWED'
    old = {**BOB, 'PK': 'USER#o', 'uuid': 'o', 'username': 'old', 'guest_expires_at': 1}
    assert _code(_seed(old), 'old') == 'USER_EXPIRED'
    busy = {'PK': 'MATCH#m9', 'SK': 'METADATA', 'uuid': 'm9', 'storyUuid': 's1', 'status': 'PAUSED',
            'userCreatorUuid': B_UUID, 'GSI1_PK': f'USER_MATCHES#{B_UUID}'}
    assert _code(_seed(busy), 'bob') == 'ACTIVE_MATCH_ALREADY_EXISTS'


def test_an_imported_guest_without_expiry_is_a_valid_target():
    imported = {'PK': 'USER#i', 'SK': 'METADATA', 'uuid': 'i', 'username': 'imp', 'role': 'PLAYER', 'state': 6,
                'email': 'imp@x.it'}
    with _env(_seed(imported)) as table:
        result = _call('PUT', body={'user': 'IMP@x.it'})
        meta = table.get_item(PK)
    assert _body(result)['status'] == 'MOVED' and meta['userCreatorUuid'] == 'i'


# ── snapshots and export keep the current owner ─────────────────────────────

def _snapshot():
    repo.begin()
    snap.write_at_time_end(repo.match(MATCH_UUID), MATCH_UUID)
    repo.flush()


def test_check_and_restore_after_a_move_keep_the_new_owner():
    with _env(_seed()) as table:
        _snapshot()
        uuid = table.rows(PK, 'SNAPSHOT#')[0]['uuid']
        _call('PUT', body={'user': 'bob'})
        table.delete_item('USER#player-uuid-001')
        check = _body(_call('GET', f'/api/admin/matches/{MATCH_UUID}/snapshots/{uuid}/check'))
        restored = _call('POST', f'/api/admin/matches/{MATCH_UUID}/snapshots/{uuid}/restore')
        meta = table.get_item(PK)
        c1 = table.get_item(PK, 'CHARACTER#c1')
    assert check == {'valid': True, 'errors': []}
    assert restored['statusCode'] == 200
    assert meta['userCreatorUuid'] == B_UUID and meta['GSI1_PK'] == f'USER_MATCHES#{B_UUID}'
    assert c1['userUuid'] == B_UUID


def test_with_current_owner_rules():
    payload = {'metadata': {'userCreatorUuid': 'old'}, 'characters': [{'SK': 'CHARACTER#c1', 'userUuid': 'old'},
                                                                      {'SK': 'CHARACTER#gone', 'userUuid': 'old'}]}
    with patch('match.snapshots.repo.characters', return_value=[{'SK': 'CHARACTER#c1', 'userUuid': 'cur'}]):
        out = snap.with_current_owner({'userCreatorUuid': 'new'}, MATCH_UUID, payload)
    assert out['metadata']['userCreatorUuid'] == 'new'
    assert [c['userUuid'] for c in out['characters']] == ['cur', 'new']
    assert payload['metadata']['userCreatorUuid'] == 'old'
    assert snap.with_current_owner({}, MATCH_UUID, payload) is payload
    assert snap.with_current_owner({'userCreatorUuid': 'n'}, MATCH_UUID, None) is None
    assert snap.with_current_owner({'userCreatorUuid': 'n'}, MATCH_UUID, {'characters': []}) == {'characters': []}
    assert 'userCreatorUuid' in snap._META_KEEP


def test_a_current_creator_gone_is_still_user_missing():
    item = {'payload': {'v': 1, 'matchUuid': MATCH_UUID, 'storyUuid': 's1', 'metadata': {}, 'characters': []}}
    item['checksum'] = snap.sha256(snap.canonical(item['payload']))
    errors = snap.verify({'storyUuid': 's1', 'userCreatorUuid': 'gone'}, MATCH_UUID, item, {}, lambda u: False)
    assert errors == [{'code': 'USER_MISSING', 'message': 'user gone no longer exists'}]


def test_export_after_a_move_carries_the_new_owner():
    with _env(_seed()) as table:
        _snapshot()
        _call('PUT', body={'user': 'bob'})
        result = _call('POST', f'/api/admin/matches/{MATCH_UUID}/export')
    doc = json.loads(result['body'])
    assert result['statusCode'] == 200
    assert doc['match']['creatorUserUuid'] == B_UUID
    assert [u['uuid'] for u in doc['users']] == [B_UUID]
    assert doc['characters'][0]['userUuid'] == B_UUID


# ── auth GET /api/admin/users/{identifier} ──────────────────────────────────

def _auth(path, items, token='admin'):
    from auth.handler import lambda_handler
    table = FakeTable(items)
    event = admin_event('GET', path) if token == 'admin' else make_event(
        'GET', path, headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'})
    with patch_table(table, module='auth.handler'):
        return lambda_handler(event, {})


AUTH_ADMIN = {**ADMIN, 'state': 2}


def test_admin_user_preview():
    ok = _auth('/api/admin/users/bob', [AUTH_ADMIN, BOB, PLAYER])
    by_email = _auth('/api/admin/users/player1%40test.local',
                     [AUTH_ADMIN, {**PLAYER, 'email': 'player1@test.local'}])
    admin = _auth('/api/admin/users/admin', [AUTH_ADMIN])
    assert ok['statusCode'] == 200 and _body(ok)['uuid'] == B_UUID and _body(ok)['eligible'] is True
    assert _body(by_email)['username'] == 'player'
    assert _body(admin)['eligible'] is False and _body(admin)['reason'] == 'USER_NOT_ALLOWED'


def test_admin_user_preview_errors():
    missing = _auth('/api/admin/users/ghost', [AUTH_ADMIN])
    twins = _auth('/api/admin/users/twin', [AUTH_ADMIN, {**BOB, 'username': 'twin'},
                                             {**BOB, 'PK': 'USER#t2', 'uuid': 't2', 'username': 'twin'}])
    player = _auth('/api/admin/users/bob', [PLAYER, BOB], token='player')
    assert missing['statusCode'] == 404 and _body(missing)['error'] == 'USER_NOT_FOUND'
    assert twins['statusCode'] == 409 and _body(twins)['error'] == 'USER_AMBIGUOUS'
    assert player['statusCode'] == 403
