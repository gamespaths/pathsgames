"""Unit tests for the Step 28 movement routes in ``lambda/match/handler.py``.

A tiny in-memory DynamoDB single-table store backs ``db_utils`` so the
movement + locations flow runs end-to-end without AWS.
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


def _match(uuid='m1', status='RUNNING', owner='player-uuid-001', clock=0, weather=None, registry=None):
    item = {
        'PK': f'MATCH#{uuid}', 'SK': 'METADATA', 'uuid': uuid,
        'status': status, 'currentClock': clock, 'userCreatorUuid': owner,
        'storyUuid': 's1', 'tsInsert': 1,
    }
    if weather is not None:
        item['currentWeatherId'] = weather
    if registry is not None:
        item['registry'] = registry
    return item


def _story(uuid='s1'):
    return {
        'PK': f'STORY#{uuid}', 'SK': 'METADATA', 'uuid': uuid,
        'locations': [
            {'id': 1, 'uuid': 'loc-1', 'idCard': 2, 'secureParam': 1, 'costEnergyEnter': 0},
            {'id': 2, 'uuid': 'loc-2', 'idCard': 3, 'secureParam': 0, 'costEnergyEnter': 0},
        ],
        'neighbors': [
            {'id': 1, 'idLocationFrom': 1, 'idLocationTo': 2, 'direction': 'N', 'energyCost': 2},
        ],
        'weatherRules': [
            {'id': 9, 'uuid': 'w-9', 'costMoveSafeLocation': 1, 'costMoveNotSafeLocation': 5},
        ],
    }


def _char(match_uuid, cid, uuid, owner='player-uuid-001', energy=50, location=1, sleeping=0):
    return {
        'PK': f'MATCH#{match_uuid}', 'SK': f'CHARACTER#{uuid}',
        'id': cid, 'uuid': uuid, 'userUuid': owner,
        'energy': energy, 'idLocation': location, 'weightMax': 30,
        'isSleeping': sleeping, 'isComa': 0,
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
               return_value={'uuid': 'player-uuid-001'}), \
         patch('match.handler.db_utils.get_item', side_effect=table.get_item), \
         patch('match.handler.db_utils.put_item', side_effect=table.put_item), \
         patch('match.handler.db_utils.query_by_pk', side_effect=table.query_by_pk):
        yield table


def _event(method, path, body=None, uuid_match='m1', role='PLAYER'):
    headers = {'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'}
    return make_event(method, path, body=body, headers=headers,
                      path_params={'uuidMatch': uuid_match})


# ── movements/start ────────────────────────────────────────────────────────────

def test_move_success_deducts_energy():
    items = [PLAYER, _story(), _match(clock=3), _char('m1', 1, 'c1', energy=10, location=1)]
    with _env(items) as table:
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-2'}), None)
    assert result['statusCode'] == 200
    body = _body(result)
    # target unsafe (secureParam 0), no weather → edge 2 + entry 0 + 0 = 2
    assert body['energySpent'] == 2
    assert body['newEnergy'] == 8
    assert body['toLocationUuid'] == 'loc-2'
    # character moved
    char = table.get_item('MATCH#m1', 'CHARACTER#c1')
    assert char['idLocation'] == 2
    assert char['energy'] == 8


def test_move_applies_weather_modifier_unsafe():
    items = [PLAYER, _story(), _match(clock=3, weather=9), _char('m1', 1, 'c1', energy=20)]
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-2'}), None)
    # target unsafe → weather costMoveNotSafe 5; edge 2 + 0 + 5 = 7
    assert _body(result)['energySpent'] == 7


def test_move_missing_target():
    items = [PLAYER, _story(), _match(), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start', body={}), None)
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'MISSING_TARGET'


def test_move_match_not_found():
    items = [PLAYER]
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-2'}), None)
    assert result['statusCode'] == 404


def test_move_not_running():
    items = [PLAYER, _story(), _match(status='CREATED'), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-2'}), None)
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'MATCH_NOT_RUNNING'


def test_move_sleeping_blocked():
    items = [PLAYER, _story(), _match(), _char('m1', 1, 'c1', sleeping=1)]
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-2'}), None)
    assert _body(result)['error'] == 'CHARACTER_CANNOT_ACT'


def test_move_not_a_neighbor():
    items = [PLAYER, _story(), _match(), _char('m1', 1, 'c1', location=2)]  # at 2, no edge 2→?
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-2'}), None)
    # target == current location; no self edge → NOT_A_NEIGHBOR
    assert _body(result)['error'] == 'NOT_A_NEIGHBOR'


def test_move_insufficient_energy():
    items = [PLAYER, _story(), _match(), _char('m1', 1, 'c1', energy=1)]
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-2'}), None)
    assert _body(result)['error'] == 'INSUFFICIENT_ENERGY'


def test_move_condition_not_met():
    story = _story()
    story['neighbors'][0]['conditionKey'] = 'DOOR'
    story['neighbors'][0]['conditionValue'] = 'OPEN'
    items = [PLAYER, story, _match(registry=[{'key': 'DOOR', 'stringValue': 'CLOSED'}]),
             _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-2'}), None)
    assert _body(result)['error'] == 'MOVEMENT_CONDITION_NOT_MET'


def test_move_one_way_backward_blocked():
    # Edge 1->2 is one-way (flagBack=0). Character on 2 cannot go back to 1.
    story = _story()
    story['neighbors'][0]['flagBack'] = 0
    items = [PLAYER, story, _match(), _char('m1', 1, 'c1', location=2)]
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-1'}), None)
    assert _body(result)['error'] == 'NOT_A_NEIGHBOR'


def test_move_two_way_backward_allowed():
    # Edge 1->2 is two-way (flagBack=1). Character on 2 can go back to 1.
    story = _story()
    story['neighbors'][0]['flagBack'] = 1
    items = [PLAYER, story, _match(), _char('m1', 1, 'c1', energy=20, location=2)]
    with _env(items):
        result = h.lambda_handler(
            _event('POST', '/api/gameplay/m1/movements/start',
                   body={'targetLocationUuid': 'loc-1'}), None)
    assert result['statusCode'] == 200
    assert _body(result)['toLocationUuid'] == 'loc-1'


# ── locations ──────────────────────────────────────────────────────────────────

def test_locations_one_way_backward_hidden():
    # Edge 1->2 one-way: standing on 2, location 1 must not appear as a neighbor.
    story = _story()
    story['neighbors'][0]['flagBack'] = 0
    items = [PLAYER, story, _match(), _char('m1', 1, 'c1', location=2)]
    with _env(items):
        result = h.lambda_handler(_event('GET', '/api/match/m1/locations'), None)
    assert result['statusCode'] == 200
    loc = next(l for l in _body(result)['locations'] if l['idLocation'] == 2)
    assert loc['neighbors'] == []


def test_locations_lists_visited_with_total_cost():
    items = [PLAYER, _story(), _match(weather=9), _char('m1', 1, 'c1', location=1)]
    with _env(items):
        result = h.lambda_handler(_event('GET', '/api/match/m1/locations'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    loc = next(l for l in body['locations'] if l['idLocation'] == 1)
    assert loc['characterCount'] == 1
    assert loc['safe'] is True
    nb = loc['neighbors'][0]
    # neighbor loc-2 unsafe → edge 2 + 0 + weatherNotSafe 5 = 7
    # breakdown: edge 2 + entry 0 + weatherNotSafe 5 = 7
    assert nb['baseEnergyCost'] == 2
    assert nb['entryEnergyCost'] == 0
    assert nb['weatherEnergyCost'] == 5
    assert nb['totalEnergyCost'] == 7
    assert nb['uuid'] == 'loc-2'


def test_admin_locations():
    admin = {**PLAYER, 'role': 'ADMIN'}
    items = [admin, _story(), _match(), _char('m1', 1, 'c1', location=1)]
    with _env(items):
        result = h.lambda_handler(
            make_event('GET', '/api/admin/matches/m1/locations',
                       headers={'Authorization': 'Bearer MOCK'},
                       path_params={'uuidMatch': 'm1'}), None)
    assert result['statusCode'] == 200
    assert _body(result)['locations'][0]['idLocation'] == 1
