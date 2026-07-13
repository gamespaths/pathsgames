"""Unit tests for the Step 25 time advancement & clock routes in
``lambda/match/handler.py``.

A tiny in-memory DynamoDB single-table store backs ``db_utils`` so the
sleep -> time-end -> clock flow runs end-to-end without AWS.
"""
import json
from contextlib import contextmanager
from unittest.mock import patch

from match import handler as h
from helpers import make_event


def _body(result):
    return json.loads(result['body'])


PLAYER = {
    'PK': 'USER#player-uuid-001', 'SK': 'METADATA',
    'uuid': 'player-uuid-001', 'username': 'player', 'role': 'PLAYER', 'state': 2,
}


def _match(uuid='m1', status='RUNNING', owner='player-uuid-001', clock=0):
    return {
        'PK': f'MATCH#{uuid}', 'SK': 'METADATA', 'uuid': uuid,
        'status': status, 'currentClock': clock, 'userCreatorUuid': owner,
        'storyUuid': 's1', 'tsInsert': 1,
    }


def _story(uuid='s1', singular='hour', plural='hours'):
    return {
        'PK': f'STORY#{uuid}', 'SK': 'METADATA', 'uuid': uuid,
        'clockSingularDescription': singular, 'clockPluralDescription': plural,
    }


def _char(match_uuid, cid, uuid, owner='player-uuid-001', dex=3, life=10,
          energy=50, sleeping=0):
    return {
        'PK': f'MATCH#{match_uuid}', 'SK': f'CHARACTER#{uuid}',
        'id': cid, 'uuid': uuid, 'userUuid': owner,
        'dexterity': dex, 'intelligence': 3, 'constitution': 3, 'life': life,
        'energy': energy, 'isSleeping': sleeping,
    }


class FakeTable:
    def __init__(self, items):
        self.store = {(i['PK'], i.get('SK', 'METADATA')): dict(i) for i in items}

    def get_item(self, pk, sk='METADATA'):
        it = self.store.get((pk, sk))
        return dict(it) if it else None

    def put_item(self, item):
        self.store[(item['PK'], item.get('SK', 'METADATA'))] = dict(item)

    def query_by_pk(self, pk):
        return [dict(v) for (p, _), v in self.store.items() if p == pk]


@contextmanager
def _env(items):
    table = FakeTable(items)
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'player-uuid-001'}) as mock_jwt, \
         patch('match.handler.db_utils.get_item', side_effect=table.get_item), \
         patch('match.handler.db_utils.put_item', side_effect=table.put_item), \
         patch('match.handler.db_utils.query_by_pk', side_effect=table.query_by_pk):
        yield table, mock_jwt


def _event(method, path, uuid_match='m1'):
    return make_event(method, path,
                      headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'},
                      path_params={'uuidMatch': uuid_match})


# ── sleep ─────────────────────────────────────────────────────────────────────

def test_sleep_triggers_time_end_and_advances_clock():
    items = [PLAYER, _story(), _match(clock=3), _char('m1', 1, 'c1', energy=50)]
    with _env(items) as (table, _):
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['timeEndTriggered'] is True
    assert body['currentClock'] == 4
    assert body['isSleeping'] is False  # woke up at time start
    # clock-history item appended and queue rebuilt
    rows = table.query_by_pk('MATCH#m1')
    assert any(r.get('SK') == 'CLOCK#4' for r in rows)
    turns = [r for r in rows if str(r.get('SK', '')).startswith('TURN#')]
    assert len(turns) == 1
    assert turns[0]['status'] == 'ACTIVE'


def test_sleep_without_trigger_keeps_clock():
    items = [PLAYER, _story(), _match(clock=3),
             _char('m1', 1, 'c1', energy=50),
             _char('m1', 2, 'c2', owner='other-uuid-002', energy=90)]
    with _env(items) as (table, _):
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
    body = _body(result)
    assert body['timeEndTriggered'] is False
    assert body['currentClock'] == 3
    assert body['isSleeping'] is True
    rows = table.query_by_pk('MATCH#m1')
    assert not any(str(r.get('SK', '')).startswith('CLOCK#') for r in rows)


def test_sleep_on_non_running_returns_409():
    items = [PLAYER, _story(), _match(status='CREATED'), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'MATCH_NOT_RUNNING'


def test_sleep_unknown_match_returns_404():
    items = [PLAYER]
    with _env(items):
        result = h.lambda_handler(_event('POST', '/api/gameplay/nope/action/sleep',
                                          uuid_match='nope'), None)
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


def test_sleep_caller_without_character_returns_404():
    items = [PLAYER, _story(), _match(), _char('m1', 1, 'c1', owner='other-uuid-002')]
    with _env(items):
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


# ── Step 26 recovery ────────────────────────────────────────────────────────

def _story_recovery(uuid='s1'):
    """STORY item with a safe start location, a counter location, a difficulty
    and a class bonus, for the Step 26 recovery flow."""
    return {
        'PK': f'STORY#{uuid}', 'SK': 'METADATA', 'uuid': uuid,
        'clockSingularDescription': 'hour', 'clockPluralDescription': 'hours',
        'difficulties': [{'uuid': 'd1', 'energy': 2}],
        'classes': [{'uuid': 'cl1', 'id': 1}],
        'classBonuses': [{'idClass': 1, 'statistic': 'energy', 'value': 1}],
        'locations': [
            {'id': 1, 'secureParam': 1, 'idEventIfCounterZero': None},
            {'id': 2, 'secureParam': 0, 'counterTime': 1, 'idEventIfCounterZero': 99},
        ],
    }


def _match_recovery(uuid='m1', clock=0):
    m = _match(uuid=uuid, clock=clock)
    m['difficultyUuid'] = 'd1'
    m['locations'] = [
        {'idLocation': 1, 'clockCounter': 0},
        {'idLocation': 2, 'clockCounter': 1},
    ]
    return m


def _char_recovery(match_uuid, cid, uuid, **over):
    c = _char(match_uuid, cid, uuid, dex=3, life=20, energy=10)
    c.update({
        'intelligence': 2, 'constitution': 4, 'sad': 8,
        'energyMax': 100, 'lifeMax': 100, 'sadMax': 100,
        'classUuid': 'cl1', 'idLocation': 1,
    })
    c.update(over)
    return c


def test_sleep_recovers_stats_and_decrements_counter():
    items = [PLAYER, _story_recovery(), _match_recovery(clock=0),
             _char_recovery('m1', 1, 'c1')]
    with _env(items) as (table, _):
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['timeEndTriggered'] is True
    # secureParam=1, difficultyEnergy=2, p=3; safe; +energy bonus 1.
    # energy 10 + dex3 + p3 + bonus1 = 17 (+7)
    # life   20 + cos4 + secureParam1 = 25 (+5)
    # sad    8 - (int2 + secureParam1) = 5 (-3)
    assert len(body['recovery']) == 1
    rec = body['recovery'][0]
    assert (rec['energyDelta'], rec['lifeDelta'], rec['sadDelta']) == (7, 5, -3)
    char = table.get_item('MATCH#m1', 'CHARACTER#c1')
    assert (char['energy'], char['life'], char['sad']) == (17, 25, 5)
    # counter location 2 decremented 1 -> 0 and flagged with the pending event
    match = table.get_item('MATCH#m1')
    loc2 = next(l for l in match['locations'] if l['idLocation'] == 2)
    assert loc2['clockCounter'] == 0
    assert loc2['pendingEvent'] == 99
    assert loc2.get('flagAlreadyActived') == 1


def test_sleep_reseeds_zero_counter_for_occupied_location():
    """Match created before counterTime was set: clockCounter=0 + flagAlreadyActived=0
    must be re-seeded to counterTime, then immediately decremented."""
    story = {
        'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
        'clockSingularDescription': 'hour', 'clockPluralDescription': 'hours',
        'difficulties': [],
        'classes': [],
        'classBonuses': [],
        'locations': [
            {'id': 10, 'secureParam': 0, 'counterTime': 5, 'idEventIfCounterZero': None},
        ],
    }
    match = {
        'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1',
        'status': 'RUNNING', 'currentClock': 0, 'userCreatorUuid': 'player-uuid-001',
        'storyUuid': 's1', 'tsInsert': 1,
        'locations': [
            # pre-seeded with 0 when match was created (before counterTime was added)
            {'idLocation': 10, 'clockCounter': 0, 'flagAlreadyActived': 0},
        ],
    }
    char = _char('m1', 1, 'c1', energy=50)
    char['idLocation'] = 10
    items = [PLAYER, story, match, char]
    with _env(items) as (table, _):
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
    assert result['statusCode'] == 200
    assert _body(result)['timeEndTriggered'] is True
    saved_match = table.get_item('MATCH#m1')
    loc10 = next(l for l in saved_match['locations'] if l['idLocation'] == 10)
    # must have been re-seeded to 5 then decremented to 4
    assert loc10['clockCounter'] == 4


# ── clock ─────────────────────────────────────────────────────────────────────

def test_clock_returns_labels_and_character_state():
    items = [PLAYER, _story(), _match(clock=5),
             _char('m1', 1, 'c1', energy=40, sleeping=1)]
    with _env(items):
        result = h.lambda_handler(_event('GET', '/api/match/m1/clock'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['currentClock'] == 5
    assert body['clockLabelSingular'] == 'hour'
    assert body['clockLabelPlural'] == 'hours'
    assert body['anyCharacterSleeping'] is True
    assert len(body['characters']) == 1
    assert body['characters'][0]['energy'] == 40
    assert body['characters'][0]['isSleeping'] is True


def _story_imported(uuid='s1', singular='turn', plural='turns', lang='en'):
    """STORY item as written by the import path: no pre-resolved descriptions,
    only the multi-lang ``texts`` map + the id_text_clock_* references."""
    return {
        'PK': f'STORY#{uuid}', 'SK': 'METADATA', 'uuid': uuid,
        'idTextClockSingular': 10, 'idTextClockPlural': 11,
        'texts': {lang: {'clockSingular': singular, 'clockPlural': plural}},
    }


def test_clock_resolves_labels_from_texts_when_descriptions_absent():
    # Guards the regression: imported stories carry only `texts`, so the clock
    # endpoint must resolve the labels from there (not return null).
    items = [PLAYER, _story_imported(), _match(clock=2), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('GET', '/api/match/m1/clock'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['clockLabelSingular'] == 'turn'
    assert body['clockLabelPlural'] == 'turns'


def test_clock_labels_null_when_story_has_no_clock_data():
    # No descriptions and no texts -> labels are null (not a crash).
    story = {'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1'}
    items = [PLAYER, story, _match(), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('GET', '/api/match/m1/clock'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['clockLabelSingular'] is None
    assert body['clockLabelPlural'] is None


def test_clock_not_owner_returns_404():
    items = [PLAYER, _story(), _match(owner='other-uuid-002'), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('GET', '/api/match/m1/clock'), None)
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


def test_clock_without_token_returns_401():
    items = [PLAYER, _story(), _match()]
    with _env(items):
        ev = make_event('GET', '/api/match/m1/clock', path_params={'uuidMatch': 'm1'})
        result = h.lambda_handler(ev, None)
    assert result['statusCode'] == 401
