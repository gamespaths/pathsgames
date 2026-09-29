"""v0.41.1 Step 41 A — logging gaps on AWS: PASS, EDGE_STATE, TRAIT_CHANGE, MATCH_LIFECYCLE,
ADMIN_ACTION and RECOVERY LOG# rows, the admin logCount and the logbook size check."""
import json
from contextlib import contextmanager
from unittest.mock import patch

from match import handler as h
from match import logbook
from match import repo
from helpers import make_event, FakeTable, patch_table

MATCH_UUID, STORY_UUID = 'm1', 's1'
LOC_A, LOC_B = 90001, 90002
PLAYER_TOKEN = {'Authorization': 'Bearer player'}
ADMIN_TOKEN = {'Authorization': 'Bearer admin'}
PLAYER = {'PK': 'USER#player-uuid-001', 'SK': 'METADATA', 'uuid': 'player-uuid-001',
          'username': 'player', 'role': 'PLAYER', 'state': 2}
ADMIN = {'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001',
         'username': 'admin', 'role': 'ADMIN', 'state': 2}


def _body(result):
    return json.loads(result['body'])


def _match(status='RUNNING', clock=2, counter=0):
    return {
        'PK': f'MATCH#{MATCH_UUID}', 'SK': 'METADATA', 'uuid': MATCH_UUID, 'name': 'robottest_x',
        'status': status, 'currentClock': clock, 'userCreatorUuid': 'player-uuid-001',
        'storyUuid': STORY_UUID, 'difficultyUuid': 'd1', 'tsInsert': 1, 'rngSeed': 42,
        'currentWeatherId': None, 'logCount': 0, 'logSeq': 0,
        'locations': [{'idLocation': LOC_A, 'uuid': 'sl-a', 'flagAlreadyActived': 0,
                       'flagVisited': 1, 'clockCounter': counter}],
        'registry': [], 'eventMarkers': {}, 'executedEventIds': [],
    }


def _event(eid, uuid, **over):
    base = {'id': eid, 'uuid': uuid, 'type': 'NORMAL', 'costEnery': 0, 'coinCost': 0,
            'flagEndTime': 0, 'idEventNext': None, 'idCard': None}
    base.update(over)
    return base


def _story(events=(), effects=()):
    return {
        'PK': f'STORY#{STORY_UUID}', 'SK': 'METADATA', 'uuid': STORY_UUID,
        'idLocationStart': LOC_A, 'idEventEndGame': 40,
        'difficulties': [{'uuid': 'd1', 'energy': 0, 'expCost': 5}],
        'locations': [{'id': LOC_A, 'uuid': 'loc-a', 'idCard': 1, 'costEnergyEnter': 0,
                       'maxCharacters': 10, 'secureParam': 1, 'idEventIfCounterZero': 777},
                      {'id': LOC_B, 'uuid': 'loc-b', 'idCard': 2, 'costEnergyEnter': 0,
                       'maxCharacters': 10, 'secureParam': 0}],
        'locationNeighbors': [],
        'events': [_event(777, 'evt-fuse', type='AUTOMATIC'), _event(40, 'evt-end', type='END'),
                   *events],
        'eventEffects': [{'id': 900, 'idEvent': 777, 'traitsToAdd': '1', 'target': 'ALL'},
                         *effects],
        'choices': [], 'choiceEffects': [], 'choiceConditions': [], 'items': [], 'classes': [],
        'traits': [{'id': 1, 'uuid': 'trait-1'}], 'weatherRules': [],
        'raw_cards': [], 'raw_texts': [],
    }


def _char(uuid='c1', cid=1, **over):
    base = {'PK': f'MATCH#{MATCH_UUID}', 'SK': f'CHARACTER#{uuid}', 'id': cid, 'uuid': uuid,
            'userUuid': 'player-uuid-001', 'idLocation': LOC_A, 'dexterity': 3,
            'intelligence': 3, 'constitution': 3, 'life': 10, 'energy': 50, 'energyMax': 100,
            'lifeMax': 100, 'sadMax': 50, 'sad': 0, 'isSleeping': 0, 'isComa': 0,
            'weightMax': 30, 'food': 0, 'magic': 0, 'coin': 0, 'traitUuids': []}
    base.update(over)
    return base


def _turn(uuid='c1', cid=1, status='ACTIVE'):
    return {'PK': f'MATCH#{MATCH_UUID}', 'SK': f'TURN#{uuid}', 'idCharacter': cid,
            'characterUuid': uuid, 'priority': 10, 'clock': 2, 'status': status,
            'passCounter': 0}


def _claims(token):
    return {'uuid': 'admin-uuid-001' if token == 'admin' else 'player-uuid-001'}


@contextmanager
def _env(items):
    table = FakeTable([PLAYER, ADMIN, *items])
    with patch('match.handler.jwt_utils.verify_access_token', side_effect=_claims), \
            patch('match.handler.db_utils.query_gsi', return_value=[]), patch_table(table):
        yield table


def _call(method, path, body=None, headers=PLAYER_TOKEN):
    return h.lambda_handler(make_event(method, path, body=body, headers=dict(headers),
                                       path_params={'uuidMatch': MATCH_UUID}), None)


def _rows(table, entry_type=None):
    return [r for r in table.logs(MATCH_UUID) if entry_type is None or r['type'] == entry_type]


# ── lifecycle ────────────────────────────────────────────────────────────────

def test_create_writes_the_created_row_and_counts_it():
    with _env([_story()]) as table:
        result = _call('POST', '/api/matches', {'storyUuid': STORY_UUID, 'difficultyUuid': 'd1'})
        assert result['statusCode'] == 201
        uuid = _body(result)['uuid']
        rows = table.logs(uuid)
        meta = table.get_item(f'MATCH#{uuid}')
    assert [(r['type'], r['clock'], r['message']) for r in rows] == [('MATCH_LIFECYCLE', 0, 'CREATED')]
    assert meta['logCount'] == 1


def test_start_writes_started_before_anything_else():
    story = _story()
    story['weatherRules'] = [{'id': 1, 'uuid': 'w', 'probability': 100, 'isActive': 1}]
    with _env([story, _match(status='CREATED', clock=0), _char()]) as table:
        assert _call('POST', f'/api/matches/{MATCH_UUID}/start')['statusCode'] == 200
        rows = _rows(table)
    assert (rows[0]['type'], rows[0]['message'], rows[0]['clock']) == ('MATCH_LIFECYCLE', 'STARTED', 0)
    assert 'WEATHER' in [r['type'] for r in rows[1:]]


def test_story_end_writes_ended_last():
    with _env([_story(), _match(), _char()]) as table:
        assert _call('PATCH', f'/api/match/{MATCH_UUID}/end/evt-end')['statusCode'] == 200
        rows = _rows(table)
    assert (rows[-1]['type'], rows[-1]['message'], rows[-1]['clock']) == ('MATCH_LIFECYCLE', 'ENDED', 2)


# ── pass, edge states, recovery, traits ──────────────────────────────────────

def test_pass_writes_a_pass_row_for_the_character_that_passed():
    with _env([_story(), _match(), _char(), _turn()]) as table:
        assert _call('POST', f'/api/gameplay/{MATCH_UUID}/action/pass')['statusCode'] == 200
        rows = _rows(table, 'PASS')
    assert [(r['characterUuid'], r['clock']) for r in rows] == [('c1', 2)]
    assert 'message' not in rows[0]


def test_a_lethal_event_writes_coma_and_all_player_coma_rows():
    story = _story(events=[_event(50, 'evt-poison')],
                   effects=[{'id': 901, 'idEvent': 50, 'statistics': 'life', 'value': -99,
                             'target': 'ONLY_ONE'}])
    with _env([story, _match(), _char()]) as table:
        _call('POST', f'/api/gameplay/{MATCH_UUID}/action/execute-event', {'eventUuid': 'evt-poison'})
        rows = _rows(table, 'EDGE_STATE')
        audits = [a for a in table.audits(MATCH_UUID) if a.get('kind') == 'EDGE_STATE']
    assert [(r['message'], r['characterUuid']) for r in rows] == [('COMA', 'c1'), ('ALL_PLAYER_COMA', 'c1')]
    assert rows[0]['idEvent'] == 50
    # The audit keeps the full message, character included.
    assert audits[0]['message'] == 'COMA c1'


def test_a_sleep_writes_one_recovery_row_per_character_and_the_coma_recovery():
    with _env([_story(), _match(counter=0), _char(life=0, isComa=1, isSleeping=1)]) as table:
        assert _call('POST', f'/api/gameplay/{MATCH_UUID}/action/sleep')['statusCode'] == 200
        recovery = _rows(table, 'RECOVERY')
        edge = _rows(table, 'EDGE_STATE')
    assert [(r['characterUuid'], r['clock']) for r in recovery] == [('c1', 3)]
    assert recovery[0]['message'].startswith('recovery safe=true p=1 dEnergy=')
    assert recovery[0]['message'].endswith(' dLife=4 dSad=0')
    assert [(r['message'], r['clock']) for r in edge] == [('COMA_RECOVERED', 3)]


def test_trait_effects_write_trait_change_rows():
    story = _story(events=[_event(60, 'evt-charm'), _event(61, 'evt-lose')],
                   effects=[{'id': 902, 'idEvent': 60, 'traitsToAdd': '1', 'target': 'ONLY_ONE'},
                            {'id': 903, 'idEvent': 61, 'traitsToRemove': '1',
                             'target': 'ONLY_ONE'}])
    with _env([story, _match(), _char()]) as table:
        _call('POST', f'/api/gameplay/{MATCH_UUID}/action/execute-event', {'eventUuid': 'evt-charm'})
        _call('POST', f'/api/gameplay/{MATCH_UUID}/action/execute-event', {'eventUuid': 'evt-lose'})
        rows = _rows(table, 'TRAIT_CHANGE')
    assert [(r['message'], r['idEvent'], r['characterUuid']) for r in rows] == [
        ('ADD trait-1', 60, 'c1'), ('REMOVE trait-1', 61, 'c1')]


def test_an_automatic_event_now_grants_its_traits_and_logs_them():
    with _env([_story(), _match(counter=1), _char()]) as table:
        _call('POST', f'/api/gameplay/{MATCH_UUID}/action/sleep')
        rows = _rows(table, 'TRAIT_CHANGE')
        char = table.get_item(f'MATCH#{MATCH_UUID}', 'CHARACTER#c1')
    assert [(r['message'], r['idEvent']) for r in rows] == [('ADD trait-1', 777)]
    assert char['traitUuids'] == ['trait-1']


def test_log_trait_changes_without_an_event():
    match = _match()
    h._log_trait_changes(match, [{'characterUuid': 'c1', 'traitUuid': 't', 'action': 'ADD'}], None)
    assert [(r['message'], r.get('idEvent')) for r in match['_pendingLogs']] == [('ADD t', None)]


# ── admin ────────────────────────────────────────────────────────────────────

def test_admin_actions_write_admin_action_rows():
    with _env([_story(), _match(), _char()]) as table:
        base = f'/api/admin/matches/{MATCH_UUID}'
        for action in ('pause', 'resume', 'stop'):
            assert _call('POST', f'{base}/{action}', headers=ADMIN_TOKEN)['statusCode'] == 200
        _call('PUT', base, {'status': 'PAUSED'}, headers=ADMIN_TOKEN)
        _call('PUT', base, {'name': 'renamed'}, headers=ADMIN_TOKEN)
        assert _call('PUT', base, {'status': 'BOGUS'}, headers=ADMIN_TOKEN)['statusCode'] == 400
        rows = _rows(table, 'ADMIN_ACTION')
        info = _body(_call('GET', f'{base}/info', headers=ADMIN_TOKEN))
    assert [r['message'] for r in rows] == ['PAUSE', 'RESUME', 'STOP', 'STATUS PAUSED']
    assert info['logCount'] == 4


def test_change_statistics_writes_one_stats_row():
    with _env([_story(), _match(), _char(life=0, isComa=1)]) as table:
        path = f'/api/admin/matches/{MATCH_UUID}/player/c1/changeStatistics'
        _call('POST', path, {'energy': 500, 'coin': 3, 'coma': False}, headers=ADMIN_TOKEN)
        rows = _rows(table, 'ADMIN_ACTION')
        char = table.get_item(f'MATCH#{MATCH_UUID}', 'CHARACTER#c1')
    assert [(r['message'], r['characterUuid']) for r in rows] == [
        ('STATS energy=100 life=1 coin=3 sleeping=false coma=false', 'c1')]
    assert 'logSeq' not in char


def test_stats_message_order_and_flags():
    assert h._stats_message({'isSleeping': 1, 'dexterity': 4, 'exp': 0}) == \
        'STATS dex=4 exp=0 sleeping=true'


# ── logbook size check ───────────────────────────────────────────────────────

def _metadata(count, **over):
    base = {'PK': 'MATCH#big', 'SK': 'METADATA', 'uuid': 'big', 'logCount': count, 'logSeq': count}
    base.update(over)
    return base


def test_log_size_warns_when_the_count_crosses_the_threshold(monkeypatch, capsys):
    monkeypatch.setenv('LOG_WARN_ROWS', '3')
    match = _metadata(2)
    repo.begin()
    logbook.append(match, 'PASS', 1)
    logbook.append(match, 'PASS', 1)
    logbook.persist(match)
    logbook.append(match, 'PASS', 1)
    logbook.persist(match)
    repo.flush()
    lines = [json.loads(l) for l in capsys.readouterr().out.splitlines() if 'LOG_SIZE' in l]
    assert lines == [{'level': 'WARN', 'event': 'LOG_SIZE', 'matchUuid': 'big',
                      'logCount': 4, 'threshold': 3}]


def test_log_size_off_and_bad_values(monkeypatch, capsys):
    monkeypatch.setenv('LOG_WARN_ROWS', '0')
    monkeypatch.setenv('LOG_WARN_METADATA_KB', 'junk')
    match = _metadata(0)
    repo.begin()
    logbook.append(match, 'PASS', 1)
    logbook.persist(match)
    repo.flush()
    assert 'LOG_SIZE' not in capsys.readouterr().out
    assert logbook._env_int('LOG_WARN_METADATA_KB', 300) == 300


def test_metadata_size_warns_once_per_container(monkeypatch, capsys):
    monkeypatch.setenv('LOG_WARN_METADATA_KB', '1')
    logbook._METADATA_WARNED.discard('big')
    match = _metadata(0, padding='x' * 2048)
    repo.begin()
    logbook.persist(match)
    logbook.persist(match)
    repo.flush()
    lines = [json.loads(l) for l in capsys.readouterr().out.splitlines() if 'METADATA_SIZE' in l]
    assert len(lines) == 1 and lines[0]['thresholdKb'] == 1 and lines[0]['sizeBytes'] > 1024
    monkeypatch.setenv('LOG_WARN_METADATA_KB', '0')
    logbook._METADATA_WARNED.discard('big')
    repo.begin()
    logbook.persist(match)
    repo.flush()
    assert 'METADATA_SIZE' not in capsys.readouterr().out


def test_persist_copies_the_match_ttl_onto_its_log_rows():
    import helpers
    match = _metadata(0, ttl=123)
    repo.begin()
    logbook.append(match, 'MATCH_LIFECYCLE', 0, message='CREATED')
    logbook.audit(match, 'EDGE_STATE', 0, message='COMA c1')
    logbook.persist(match)
    repo.flush()
    assert [r.get('ttl') for r in helpers.SINK.logs()] == [123]
    assert [r.get('ttl') for r in helpers.SINK.audit_items()] == [123]
