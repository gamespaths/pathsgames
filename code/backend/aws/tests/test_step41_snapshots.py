"""v0.41.1 Step 41 B — match snapshots on AWS: the SNAPSHOT# row of every time-end, pruning, the
admin list, every check code, the restore (LOG#/AUDIT# cut, rows back, time-start, PAUSED)."""
import gzip
import json
from contextlib import contextmanager
from unittest.mock import patch

from boto3.dynamodb.types import Binary

from match import handler as h
from match import repo
from match import snapshots as snap
from helpers import make_event, FakeTable, patch_table

MATCH_UUID, STORY_UUID = 'm1', 's1'
LOC_A, LOC_B = 90001, 90002
PLAYER_TOKEN = {'Authorization': 'Bearer player'}
ADMIN_TOKEN = {'Authorization': 'Bearer admin'}
PLAYER = {'PK': 'USER#player-uuid-001', 'SK': 'METADATA', 'uuid': 'player-uuid-001',
          'username': 'player', 'role': 'PLAYER', 'state': 2}
ADMIN = {'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001',
         'username': 'admin', 'role': 'ADMIN', 'state': 2}
PK = f'MATCH#{MATCH_UUID}'
BASE = f'/api/admin/matches/{MATCH_UUID}/snapshots'


def _body(result):
    return json.loads(result['body'])


def _match(**over):
    base = {
        'PK': PK, 'SK': 'METADATA', 'uuid': MATCH_UUID, 'name': 'robottest_x', 'status': 'RUNNING',
        'currentClock': 2, 'userCreatorUuid': 'player-uuid-001', 'storyUuid': STORY_UUID,
        'difficultyUuid': 'd1', 'tsInsert': 1, 'rngSeed': 42, 'currentWeatherId': 1,
        'currentLocationId': LOC_A, 'logCount': 0, 'logSeq': 0,
        'GSI1_PK': 'USER_MATCHES#player-uuid-001', 'GSI1_SK': 'MATCH#1#m1',
        'locations': [{'idLocation': LOC_A, 'uuid': 'sl-a', 'flagAlreadyActived': 0,
                       'flagVisited': 1, 'clockCounter': 0}],
        'registry': [{'key': 'quest', 'value': 'done', 'idEvent': 14, 'idMission': 1}],
        'eventMarkers': {}, 'executedEventIds': [],
    }
    base.update(over)
    return base


def _event(eid, uuid, **over):
    base = {'id': eid, 'uuid': uuid, 'type': 'NORMAL', 'costEnery': 0, 'coinCost': 0,
            'flagEndTime': 0, 'idEventNext': None, 'idCard': None}
    base.update(over)
    return base


def _story(**over):
    base = {
        'PK': f'STORY#{STORY_UUID}', 'SK': 'METADATA', 'uuid': STORY_UUID,
        'idLocationStart': LOC_A, 'idEventEndGame': 40,
        'difficulties': [{'uuid': 'd1', 'energy': 0, 'expCost': 5}],
        'locations': [{'id': LOC_A, 'uuid': 'loc-a', 'idCard': 1, 'costEnergyEnter': 0,
                       'maxCharacters': 10, 'secureParam': 1},
                      {'id': LOC_B, 'uuid': 'loc-b', 'idCard': 2, 'costEnergyEnter': 0,
                       'maxCharacters': 10, 'secureParam': 0}],
        'locationNeighbors': [],
        'events': [_event(13, 'evt-once', type='ONCE'), _event(14, 'evt-quest'),
                   _event(16, 'evt-long-day', flagEndTime=1), _event(40, 'evt-end', type='END')],
        'eventEffects': [{'id': 1, 'idEvent': 13, 'statistics': 'exp', 'value': 1, 'target': 'ONLY_ONE'},
                         {'id': 2, 'idEvent': 16, 'statistics': 'coin', 'value': 1,
                          'target': 'ONLY_ONE'}],
        'choices': [], 'choiceEffects': [], 'choiceConditions': [], 'items': [{'id': 5, 'uuid': 'i5'}],
        'classes': [{'id': 1, 'uuid': 'class-1'}], 'characterTemplates': [{'id': 1, 'uuid': 'tpl-1'}],
        'traits': [{'id': 1, 'uuid': 'trait-1'}], 'missions': [{'id': 1, 'uuid': 'mission-1'}],
        'weatherRules': [{'id': 1, 'uuid': 'w1', 'probability': 100, 'active': 1}],
        'raw_cards': [], 'raw_texts': [],
    }
    base.update(over)
    return base


def _char(uuid='c1', cid=1, **over):
    base = {'PK': PK, 'SK': f'CHARACTER#{uuid}', 'id': cid, 'uuid': uuid,
            'userUuid': 'player-uuid-001', 'idLocation': LOC_A, 'dexterity': 3,
            'intelligence': 3, 'constitution': 3, 'life': 10, 'energy': 50, 'energyMax': 100,
            'lifeMax': 100, 'sadMax': 50, 'sad': 0, 'isSleeping': 0, 'isComa': 0, 'exp': 0,
            'weightMax': 30, 'food': 0, 'magic': 0, 'coin': 0, 'traitUuids': ['trait-1'],
            'classUuid': 'class-1', 'characterTemplateUuid': 'tpl-1',
            'items': [{'uuid': 'inv-1', 'idItem': 5, 'amount': 1}]}
    base.update(over)
    return base


def _claims(token):
    return {'uuid': 'admin-uuid-001' if token == 'admin' else 'player-uuid-001'}


@contextmanager
def _env(items):
    table = FakeTable([PLAYER, ADMIN, *items])
    with patch('match.handler.jwt_utils.verify_access_token', side_effect=_claims), \
            patch('match.handler.db_utils.query_gsi', return_value=[]), patch_table(table):
        yield table


def _call(method, path, body=None, headers=PLAYER_TOKEN, params=None):
    return h.lambda_handler(make_event(method, path, body=body, headers=dict(headers),
                                       path_params=params or {'uuidMatch': MATCH_UUID}), None)


def _sleep():
    return _call('POST', f'/api/gameplay/{MATCH_UUID}/action/sleep')


def _snapshots(table):
    return table.rows(PK, 'SNAPSHOT#')


def _payload(item):
    return snap.payload_of(item)


# ── the time-end row ─────────────────────────────────────────────────────────

def test_a_sleep_writes_one_snapshot_of_the_clock_that_ends(monkeypatch):
    monkeypatch.setenv('ROBOT_TEST_DATA_TTL_HOURS', '1')
    with _env([_story(), _match(ttl=999), _char()]) as table:
        assert _sleep()['statusCode'] == 200
        rows = _snapshots(table)
        meta = table.get_item(PK)
    assert len(rows) == 1
    item = rows[0]
    assert item['SK'].startswith('SNAPSHOT#000002#') and item['clock'] == 2
    assert item['type'] == 'LIGHT' and item['description'] == 'Time-end of clock 2'
    assert item['ttl'] == 999
    payload = _payload(item)
    assert item['checksum'] == snap.sha256(snap.canonical(payload))
    assert payload['v'] == 1 and payload['clock'] == 2 and payload['matchUuid'] == MATCH_UUID
    assert 'GSI1_PK' not in payload['metadata'] and 'logSeq' not in payload['metadata']
    assert payload['characters'][0]['isSleeping'] == 1
    # The SLEEP row was queued in the same request: it is inside the snapshot.
    sleep_rows = [r for r in table.logs(MATCH_UUID) if r['type'] == 'SLEEP']
    assert snap._seq_of(sleep_rows[0]['SK']) <= payload['logSeq']
    clock_rows = [r for r in table.logs(MATCH_UUID) if r['type'] == 'CLOCK_ADVANCE']
    assert snap._seq_of(clock_rows[0]['SK']) > payload['logSeq']
    assert meta['currentClock'] == 3


def test_a_forced_time_end_snapshots_after_the_event_marker():
    with _env([_story(), _match(), _char()]) as table:
        _call('POST', f'/api/gameplay/{MATCH_UUID}/action/execute-event', {'eventUuid': 'evt-long-day'})
        payload = _payload(_snapshots(table)[0])
    assert payload['clock'] == 2
    assert 16 in payload['metadata']['executedEventIds']
    assert payload['characters'][0]['coin'] == 1


def test_keep_per_match_prunes_and_zero_turns_it_off(monkeypatch):
    monkeypatch.setenv('SNAPSHOT_KEEP_PER_MATCH', '2')
    with _env([_story(), _match(), _char()]) as table:
        for _ in range(3):
            _sleep()
        clocks = [r['clock'] for r in _snapshots(table)]
    assert clocks == [3, 4]
    monkeypatch.setenv('SNAPSHOT_KEEP_PER_MATCH', '0')
    with _env([_story(), _match(), _char()]) as table:
        _sleep()
        assert _snapshots(table) == []
    monkeypatch.setenv('SNAPSHOT_KEEP_PER_MATCH', 'junk')
    assert snap.keep_per_match() == 10


def test_a_failing_snapshot_never_breaks_the_time_end(capsys):
    with _env([_story(), _match(), _char()]) as table, \
            patch('match.snapshots.build_payload', side_effect=RuntimeError('boom')):
        assert _sleep()['statusCode'] == 200
        assert table.get_item(PK)['currentClock'] == 3
    assert '"event": "SNAPSHOT"' in capsys.readouterr().out


# ── admin list and check ─────────────────────────────────────────────────────

def test_list_is_newest_first_and_404_on_an_unknown_match():
    with _env([_story(), _match(), _char()]):
        _sleep()
        _sleep()
        rows = _body(_call('GET', BASE, headers=ADMIN_TOKEN))
        missing = _call('GET', '/api/admin/matches/nope/snapshots', headers=ADMIN_TOKEN,
                        params={'uuidMatch': 'nope'})
    assert [r['clock'] for r in rows] == [3, 2]
    assert set(rows[0]) == {'uuid', 'clock', 'type', 'timestamp', 'description', 'sizeBytes'}
    assert rows[0]['sizeBytes'] > 0
    assert missing['statusCode'] == 404 and _body(missing)['error'] == 'MATCH_NOT_FOUND'


def _snapshot_uuid(table):
    return _snapshots(table)[0]['uuid']


def test_check_valid_and_404s():
    with _env([_story(), _match(), _char()]) as table:
        _sleep()
        uuid = _snapshot_uuid(table)
        ok = _body(_call('GET', f'{BASE}/{uuid}/check', headers=ADMIN_TOKEN))
        unknown = _call('GET', f'{BASE}/zz/check', headers=ADMIN_TOKEN)
        unknown_restore = _call('POST', f'{BASE}/zz/restore', headers=ADMIN_TOKEN)
        other = _call('GET', f'{BASE}/zz/other', headers=ADMIN_TOKEN)
        no_match = _call('GET', '/api/admin/matches/x/snapshots/zz/check', headers=ADMIN_TOKEN,
                         params={'uuidMatch': 'x'})
    assert ok == {'valid': True, 'errors': []}
    assert unknown['statusCode'] == 404 and _body(unknown)['error'] == 'SNAPSHOT_NOT_FOUND'
    assert unknown_restore['statusCode'] == 404
    assert _body(unknown_restore)['error'] == 'SNAPSHOT_NOT_FOUND'
    assert other['statusCode'] == 404 and _body(other)['error'] == 'NOT_FOUND'
    assert _body(no_match)['error'] == 'MATCH_NOT_FOUND'


def _codes(table, original, mutate):
    item = json.loads(json.dumps(original, default=lambda b: b.decode('latin-1')))
    item[snap.PACKED] = original[snap.PACKED]
    mutate(item)
    table.put_item(item)
    return [e['code'] for e in _body(_call('GET', f"{BASE}/{item['uuid']}/check",
                                           headers=ADMIN_TOKEN))['errors']]


def _repack(item, change):
    payload = _payload(item)
    change(payload)
    text = snap.canonical(payload)
    item[snap.PACKED] = gzip.compress(('{"payload":' + text + '}').encode())
    item['checksum'] = snap.sha256(text)


def test_every_check_code():
    with _env([_story(), _match(), _char()]) as table:
        _sleep()
        original = dict(_snapshots(table)[0])
        codes = lambda mutate: _codes(table, original, mutate)
        assert codes(lambda i: i.update(checksum='0' * 64)) == ['SNAPSHOT_CHECKSUM_MISMATCH']
        assert codes(lambda i: i.update({snap.PACKED: b'junk'})) == ['SNAPSHOT_CHECKSUM_MISMATCH']
        assert codes(lambda i: _repack(i, lambda p: p.update(v=2))) == ['SNAPSHOT_VERSION_UNKNOWN']
        assert codes(lambda i: _repack(i, lambda p: p.update(matchUuid='x'))) == ['MATCH_MISMATCH']
        # v0.41.6 — the check reads the current owner, not the one the snapshot recorded.
        assert codes(lambda i: _repack(i, lambda p: p['characters'][0].update(
            userUuid='gone-user'))) == []
        assert codes(lambda i: None) == []
        story = table.get_item(f'STORY#{STORY_UUID}')
        story['traits'] = []
        story['items'] = []
        table.put_item(story)
        errors = _body(_call('GET', f'{BASE}/{original["uuid"]}/check', headers=ADMIN_TOKEN))['errors']
    assert errors == [{'code': 'STORY_ENTITY_MISSING', 'message': 'trait trait-1 is no longer in the story'},
                      {'code': 'STORY_ENTITY_MISSING', 'message': 'item 5 is no longer in the story'}]


def test_a_missing_story_misses_every_entity():
    match = _match()
    item = {'checksum': None}
    payload = {'v': 1, 'matchUuid': MATCH_UUID, 'storyUuid': STORY_UUID,
               'metadata': {'currentLocationId': LOC_A, 'registry': ['odd'], 'locations': ['odd']},
               'characters': ['odd', {'classUuid': ''}], 'logSeq': 0}
    item['payload'] = payload
    item['checksum'] = snap.sha256(snap.canonical(payload))
    errors = snap.verify(match, MATCH_UUID, item, None, lambda u: True)
    assert errors == [{'code': 'STORY_ENTITY_MISSING', 'message': f'location {LOC_A} is no longer in the story'}]


# ── restore ──────────────────────────────────────────────────────────────────

def test_restore_rolls_back_runs_the_time_start_and_pauses():
    with _env([_story(), _match(), _char()]) as table:
        _sleep()
        uuid = _snapshot_uuid(table)
        seq_at_snapshot = _payload(_snapshots(table)[0])['logSeq']
        count_at_snapshot = _payload(_snapshots(table)[0])['logCount']
        _call('POST', f'/api/gameplay/{MATCH_UUID}/action/execute-event', {'eventUuid': 'evt-once'})
        assert 13 in table.get_item(PK)['executedEventIds']
        table.put_item(_char('c-late', 3, userUuid='other-user', isSleeping=1))
        _sleep()
        seq_before = table.get_item(PK)['logSeq']
        assert len(_snapshots(table)) == 2

        result = _call('POST', f'{BASE}/{uuid}/restore', headers=ADMIN_TOKEN)

        body = _body(result)
        meta = table.get_item(PK)
        logs = table.logs(MATCH_UUID)
        chars = {r['SK'] for r in table.rows(PK, 'CHARACTER#')}
        snaps = _snapshots(table)
        c1 = table.get_item(PK, 'CHARACTER#c1')
    assert result['statusCode'] == 200
    assert body == {'status': 'RESTORED', 'uuidSnapshot': uuid, 'clock': 2, 'matchStatus': 'PAUSED',
                    'logsRemoved': body['logsRemoved']}
    assert body['logsRemoved'] > 0
    assert meta['status'] == 'PAUSED' and meta['currentClock'] == 3
    assert 13 not in meta['executedEventIds']
    assert meta['GSI1_PK'] == 'USER_MATCHES#player-uuid-001' and meta['name'] == 'robottest_x'
    assert meta['logSeq'] > seq_before
    assert meta['logCount'] == count_at_snapshot + len([r for r in logs if snap._seq_of(r['SK']) > seq_at_snapshot])
    assert c1['exp'] == 0
    assert chars == {'CHARACTER#c1'}
    assert [s['uuid'] for s in snaps] == [uuid]
    after = [r for r in logs if snap._seq_of(r['SK']) > seq_at_snapshot]
    assert [r['type'] for r in after][:2] == ['ADMIN_ACTION', 'CLOCK_ADVANCE']
    assert after[0]['message'] == 'SNAPSHOT_RESTORED clock=2' and after[0]['clock'] == 2
    assert not [r for r in logs if r['type'] == 'EVENT' and r.get('idEvent') == 13]


def test_restore_refuses_a_failed_check_and_writes_nothing():
    with _env([_story(), _match(), _char()]) as table:
        _sleep()
        item = _snapshots(table)[0]
        item['checksum'] = 'bad'
        table.put_item(item)
        before = table.get_item(PK)
        result = _call('POST', f"{BASE}/{item['uuid']}/restore", headers=ADMIN_TOKEN)
        after = table.get_item(PK)
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'SNAPSHOT_INTEGRITY_FAILED'
    assert _body(result)['errors'][0]['code'] == 'SNAPSHOT_CHECKSUM_MISMATCH'
    assert after['status'] == before['status'] == 'RUNNING'


def test_restore_an_ended_match_leaves_it_paused():
    with _env([_story(), _match(), _char()]) as table:
        _sleep()
        uuid = _snapshot_uuid(table)
        _call('PATCH', f'/api/match/{MATCH_UUID}/end/evt-end')
        assert table.get_item(PK)['status'] in ('ENDED', 'GAMEOVER')
        assert _call('POST', f'{BASE}/{uuid}/restore', headers=ADMIN_TOKEN)['statusCode'] == 200
        assert table.get_item(PK)['status'] == 'PAUSED'


# ── helpers ──────────────────────────────────────────────────────────────────

def test_payload_of_reads_every_shape():
    payload = {'v': 1}
    raw = gzip.compress(b'{"payload":{"v":1}}')
    assert snap.payload_of({'payload': payload}) is payload
    assert snap.payload_of({snap.PACKED: raw}) == payload
    assert snap.payload_of({snap.PACKED: Binary(raw)}) == payload
    assert snap.payload_of({}) is None
    assert snap.payload_of({snap.PACKED: gzip.compress(b'[1]')}) is None
    assert snap.payload_of({snap.PACKED: b'not gzip'}) is None


def test_canonical_handles_dynamodb_values():
    from decimal import Decimal
    text = snap.canonical({'b': Decimal('2'), 'a': Decimal('1.5'), 's': {'y', 'x'}, 'z': b'\x01'})
    assert text == '{"a":1.5,"b":2,"s":["x","y"],"z":"01"}'
    try:
        snap.canonical({'o': object()})
        raise AssertionError('expected TypeError')
    except TypeError:
        pass
    assert snap._seq_of('LOG#0000000000001#000042') == 42 and snap._seq_of('odd') == 0
    assert snap._nz('x') == 0


def test_repo_discard_forgets_a_queued_row():
    repo.begin()
    try:
        repo.save({'PK': PK, 'SK': 'TURN#c1'})
        with patch('match.repo.db_utils.query_sk_prefix', return_value=[]):
            repo.turns(MATCH_UUID)
        repo.save({'PK': PK, 'SK': 'TURN#c2'})
        repo.discard(PK, 'TURN#c2')
        assert [r['SK'] for r in repo.turns(MATCH_UUID)] == []
        assert repo.pending() == 1
    finally:
        repo.flush()
