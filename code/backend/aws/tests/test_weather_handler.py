"""Step 27 — unit tests for the weather routes in ``lambda/match/handler.py``.

A tiny in-memory single-table store backs ``db_utils`` so the
sleep -> time-end -> weather-selection flow runs end-to-end without AWS.
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
ADMIN = {
    'PK': 'USER#admin-uuid-001', 'SK': 'METADATA',
    'uuid': 'admin-uuid-001', 'username': 'admin', 'role': 'ADMIN', 'state': 2,
}


def _match(uuid='m1', status='RUNNING', clock=3, seed=42, weather=None, log=None):
    return {
        'PK': f'MATCH#{uuid}', 'SK': 'METADATA', 'uuid': uuid,
        'status': status, 'currentClock': clock, 'userCreatorUuid': 'player-uuid-001',
        'storyUuid': 's1', 'tsInsert': 1, 'rngSeed': seed,
        'currentWeatherId': weather, 'weatherLog': log or [], 'registry': [],
    }


def _story(uuid='s1'):
    return {
        'PK': f'STORY#{uuid}', 'SK': 'METADATA', 'uuid': uuid, 'id': 7,
        'clockSingularDescription': 'hour', 'clockPluralDescription': 'hours',
        'raw_cards': [
            {'id': 5, 'uuid': 'card-clear', 'cardType': 'weather', 'idTextTitle': 800,
             'awesomeIcon': 'fas fa-sun', 'urlImage': None},
            {'id': 6, 'uuid': 'card-storm', 'cardType': 'weather', 'idTextTitle': 801,
             'awesomeIcon': 'fas fa-cloud-bolt', 'urlImage': None},
        ],
        'raw_texts': [
            {'idText': 800, 'lang': 'en', 'shortText': 'Clear Skies'},
            {'idText': 801, 'lang': 'en', 'shortText': 'Storm'},
        ],
        'weatherRules': [
            {'uuid': 'we-clear', 'id': 1, 'idTextName': 800, 'idCard': 5, 'probability': 70,
             'deltaEnergy': 0, 'idEvent': None, 'conditionKey': None,
             'conditionValue': None, 'timeStart': None, 'timeEnd': None, 'isActive': 1,
             'costMoveSafeLocation': 0, 'costMoveNotSafeLocation': 1},
            {'uuid': 'we-storm', 'id': 2, 'idTextName': 801, 'idCard': 6, 'probability': 30,
             'deltaEnergy': -2, 'idEvent': None, 'conditionKey': None,
             'conditionValue': None, 'timeStart': None, 'timeEnd': None, 'isActive': 1,
             'costMoveSafeLocation': 1, 'costMoveNotSafeLocation': 3},
        ],
    }


def _char(match_uuid, cid, uuid, energy=50, sleeping=0):
    return {
        'PK': f'MATCH#{match_uuid}', 'SK': f'CHARACTER#{uuid}',
        'id': cid, 'uuid': uuid, 'userUuid': 'player-uuid-001',
        'dexterity': 3, 'intelligence': 3, 'constitution': 3, 'life': 10,
        'energy': energy, 'energyMax': 100, 'lifeMax': 100, 'sadMax': 100,
        'sad': 0, 'isSleeping': sleeping,
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
def _env(items, user_uuid='player-uuid-001'):
    table = FakeTable(items)
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': user_uuid, 'source': 'mock', 'role':
                             'ADMIN' if 'admin' in user_uuid else 'PLAYER'}), \
         patch('match.handler._check_admin_ip', return_value=None), \
         patch('match.handler.db_utils.get_item', side_effect=table.get_item), \
         patch('match.handler.db_utils.put_item', side_effect=table.put_item), \
         patch('match.handler.db_utils.query_by_pk', side_effect=table.query_by_pk):
        yield table


def _event(method, path, uuid_match='m1', token='player-uuid-001'):
    return make_event(method, path,
                      headers={'Authorization': f'Bearer MOCK_ACCESS_{token}'},
                      path_params={'uuidMatch': uuid_match})


# ── weather selection at time-end ─────────────────────────────────────────────

def test_sleep_selects_weather_deterministically():
    items = [PLAYER, _story(), _match(clock=3, seed=42), _char('m1', 1, 'c1', energy=50)]
    with _env(items) as table:
        result = h.lambda_handler(_event('POST', '/api/gameplay/m1/action/sleep'), None)
    assert result['statusCode'] == 200
    match = table.get_item('MATCH#m1')
    assert match['currentWeatherId'] in (1, 2)
    assert len(match['weatherLog']) == 1
    assert match['weatherLog'][0]['clock'] == 4


def test_weather_endpoint_returns_current_with_resolved_card():
    items = [PLAYER, _story(), _match(weather=2), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('GET', '/api/matches/m1/weather'), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['idWeather'] == 2
    assert body['idCard'] == 6
    assert body['card'] is not None
    assert body['card']['awesomeIcon'] == 'fas fa-cloud-bolt'
    assert body['deltaEnergy'] == -2
    assert body['costMoveNotSafeLocation'] == 3


def test_weather_endpoint_404_when_none():
    items = [PLAYER, _story(), _match(weather=None), _char('m1', 1, 'c1')]
    with _env(items):
        result = h.lambda_handler(_event('GET', '/api/matches/m1/weather'), None)
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'WEATHER_NOT_FOUND'


def test_admin_weather_endpoint_returns_seed_current_and_log():
    log = [{'id': 1, 'clock': 0, 'idWeather': 2, 'weatherUuid': 'we-storm',
            'timestampStart': 1}]
    items = [ADMIN, _story(), _match(weather=2, log=log)]
    with _env(items, user_uuid='admin-uuid-001'):
        result = h.lambda_handler(
            make_event('GET', '/api/admin/matches/m1/weather',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin-uuid-001'},
                       path_params={'uuidMatch': 'm1'}), None)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['rngSeed'] == 42
    assert body['current']['idWeather'] == 2
    assert body['current']['idCard'] == 6
    # all weather rules listed, the active one flagged current
    assert len(body['rules']) == 2
    current_rule = next(r for r in body['rules'] if r['current'])
    assert current_rule['id'] == 2
    assert current_rule['probability'] == 30
    assert current_rule['name'] == 'Storm'              # resolved from idTextName 801
    assert current_rule['costMoveSafeLocation'] == 1
    assert current_rule['costMoveNotSafeLocation'] == 3
    assert body['log'][0]['weatherUuid'] == 'we-storm'
    assert body['log'][0]['idTextName'] == 801


def test_admin_weather_blank_uuid_returns_400():
    result = h._get_admin_match_weather('  ')
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


def test_weather_blank_uuid_returns_400():
    result = h._get_weather('  ')
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


def test_weather_selection_tolerates_decimal_seed_from_dynamodb():
    """DynamoDB returns numbers as Decimal; the weighted roll must coerce the
    seed to int (random.Random rejects Decimal → 500 on /start)."""
    from decimal import Decimal
    m = {'currentClock': Decimal('0'), 'rngSeed': Decimal('42'), 'registry': [],
         'weatherLog': [], 'currentWeatherId': None, 'storyUuid': 's1', 'id': None}
    story = {'id': Decimal('7'), 'weatherRules': [
        {'uuid': 'we-clear', 'id': Decimal('1'), 'probability': Decimal('70'),
         'deltaEnergy': Decimal('0'), 'isActive': Decimal('1'), 'conditionKey': None,
         'conditionValue': None, 'timeStart': None, 'timeEnd': None},
        {'uuid': 'we-storm', 'id': Decimal('2'), 'probability': Decimal('30'),
         'deltaEnergy': Decimal('-2'), 'isActive': Decimal('1'), 'conditionKey': None,
         'conditionValue': None, 'timeStart': None, 'timeEnd': None}]}
    with patch('match.handler.db_utils.put_item'), \
         patch('match.handler._match_characters', return_value=[]):
        chosen = h._apply_weather_at_time_start(m, 'm1', story)
    assert chosen is not None
    assert m['currentWeatherId'] in (1, 2)


# ── v0.36.1 — the canonical vocabulary, which the admin and the import contract speak ──

def _rule(**over):
    rule = {'id': 1, 'uuid': 'we-1', 'probability': 100, 'deltaEnergy': 0,
            'costMoveSafeLocation': 0, 'costMoveNotSafeLocation': 0}
    rule.update(over)
    return rule


def test_a_key_condition_is_read_under_the_canonical_name():
    """The bug this guards: the engine read `conditionValue` while `list_weather_rules`,
    the admin form, the import contract and the other two backends all say
    `conditionKeyValue`. A rule authored anywhere but this backend's own seed therefore had
    NO expected value, the comparison was never met, and the weather stopped happening the
    moment it was given a condition."""
    registry = [{'key': 'EXPLORER', 'stringValue': 'Hills', 'multiValue': 1}]

    met = _rule(conditionKey='EXPLORER', conditionKeyValue='Hills')
    assert h._weather_condition_matches(met, registry) is True

    unmet = _rule(conditionKey='EXPLORER', conditionKeyValue='Lake')
    assert h._weather_condition_matches(unmet, registry) is False

    # The legacy spelling this backend's own seed authors keeps working.
    assert h._weather_condition_matches(
        _rule(conditionKey='EXPLORER', conditionValue='Hills'), registry) is True

    # No key at all is no condition: the rule is always eligible.
    assert h._weather_condition_matches(_rule(), registry) is True


def test_a_condition_over_a_multi_key_quantifies_over_the_set():
    registry = [{'key': 'EXPLORER', 'stringValue': 'Hills', 'multiValue': 1},
                {'key': 'EXPLORER', 'stringValue': 'River', 'multiValue': 1}]

    assert h._weather_condition_matches(
        _rule(conditionKey='EXPLORER', conditionKeyValue='River'), registry) is True
    assert h._weather_condition_matches(
        _rule(conditionKey='EXPLORER', conditionKeyValue='River',
              registryValueOperatorCondition='!='), registry) is False


def test_the_time_window_is_read_under_both_spellings():
    assert h._weather_time_matches(_rule(timeFrom=6, timeTo=20), 10) is True
    assert h._weather_time_matches(_rule(timeFrom=6, timeTo=20), 22) is False
    assert h._weather_time_matches(_rule(timeStart=6, timeEnd=20), 22) is False
    # A rule with no window at all is open at every hour.
    assert h._weather_time_matches(_rule(), 3) is True


def test_active_is_read_under_both_spellings_and_defaults_to_in_play():
    # A story that says nothing means the rule is in play — the column defaults to 1.
    assert h._weather_active(_rule()) == 1
    assert h._weather_active(_rule(active=1)) == 1
    # An explicit 0 under either name switches it off; it must not read as "absent".
    assert h._weather_active(_rule(active=0)) == 0
    assert h._weather_active(_rule(isActive=0)) == 0
