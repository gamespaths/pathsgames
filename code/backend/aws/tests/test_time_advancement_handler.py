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
