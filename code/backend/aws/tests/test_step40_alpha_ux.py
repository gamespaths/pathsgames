"""Step 40 — early time-end news (counterZero + weather) and resource gains in the timeline.

Mirrors EventExecutionServiceStep40Test (Java) and test_step40_alpha_ux.py (Python).
"""
import json
from contextlib import contextmanager
from unittest.mock import patch

from match import handler as h
from match import events as _events
from helpers import make_event, FakeTable, patch_table, pending_logs

MATCH_UUID, STORY_UUID = 'm1', 's1'
LOC_A, LOC_B = 90001, 90002
TOKEN = {'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'}

PLAYER = {'PK': 'USER#player-uuid-001', 'SK': 'METADATA', 'uuid': 'player-uuid-001',
          'username': 'player', 'role': 'PLAYER', 'state': 2}


def _body(result):
    return json.loads(result['body'])


def _match(clock=2, weather=1, registry=None, counter=0):
    return {
        'PK': f'MATCH#{MATCH_UUID}', 'SK': 'METADATA', 'uuid': MATCH_UUID,
        'status': 'RUNNING', 'currentClock': clock, 'userCreatorUuid': 'player-uuid-001',
        'storyUuid': STORY_UUID, 'difficultyUuid': 'd1', 'tsInsert': 1, 'rngSeed': 42,
        'currentWeatherId': weather,
        'locations': [
            {'idLocation': LOC_A, 'uuid': 'sl-a', 'flagAlreadyActived': 0, 'flagVisited': 1,
             'clockCounter': counter},
            {'idLocation': LOC_B, 'uuid': 'sl-b', 'flagAlreadyActived': 0, 'flagVisited': 0,
             'clockCounter': 0},
        ],
        'registry': registry if registry is not None else [
            {'key': 'scenario', 'stringValue': 'sun', 'multiValue': 0}],
        'eventMarkers': {}, 'executedEventIds': [],
    }


def _rule(rid, uuid, value, card):
    return {'id': rid, 'uuid': uuid, 'idCard': card, 'probability': 100, 'deltaEnergy': -1,
            'isActive': 1, 'conditionKey': 'scenario', 'conditionKeyValue': value,
            'costMoveSafeLocation': 1, 'costMoveNotSafeLocation': 2}


def _event(eid, uuid, **over):
    base = {'id': eid, 'uuid': uuid, 'type': 'NORMAL', 'costEnery': 0, 'coinCost': 0,
            'flagEndTime': 0, 'idEventNext': None, 'idCard': None}
    base.update(over)
    return base


def _story(events=(), effects=(), choices=(), choice_effects=(), loc_b=None):
    location_b = {'id': LOC_B, 'uuid': 'loc-b', 'idCard': 2, 'costEnergyEnter': 0,
                  'maxCharacters': 10, 'secureParam': 1}
    location_b.update(loc_b or {})
    return {
        'PK': f'STORY#{STORY_UUID}', 'SK': 'METADATA', 'uuid': STORY_UUID,
        'idLocationStart': LOC_A, 'difficulties': [{'uuid': 'd1', 'energy': 0}],
        'locations': [{'id': LOC_A, 'uuid': 'loc-a', 'idCard': 1, 'costEnergyEnter': 0,
                       'maxCharacters': 10, 'secureParam': 1,
                       'idEventIfCounterZero': 777},
                      location_b],
        'locationNeighbors': [{'id': 1, 'idLocationFrom': LOC_A, 'idLocationTo': LOC_B,
                               'direction': 'N', 'flagBack': 1, 'energyCost': 0}],
        'events': [_event(777, 'evt-fuse', type='AUTOMATIC'), *events],
        'eventEffects': [{'id': 900, 'idEvent': 777, 'statistics': 'food', 'value': 1,
                          'target': 'ALL'}, *effects],
        'choices': list(choices), 'choiceEffects': list(choice_effects), 'choiceConditions': [],
        'items': [], 'classes': [], 'traits': [],
        'weatherRules': [_rule(1, 'w-sun', 'sun', 5), _rule(2, 'w-rain', 'rain', 6)],
        'raw_cards': [{'id': 5, 'uuid': 'card-sun', 'idTextTitle': 800},
                      {'id': 6, 'uuid': 'card-rain', 'idTextTitle': 801},
                      {'id': 7, 'uuid': 'card-crossroads', 'idTextTitle': 802}],
        'raw_texts': [{'idText': 800, 'lang': 'en', 'shortText': 'Sun'},
                      {'idText': 801, 'lang': 'en', 'shortText': 'Rain'},
                      {'idText': 802, 'lang': 'en', 'shortText': 'Crossroads'}],
    }


def _char(uuid='c1', cid=1, location=LOC_A):
    return {'PK': f'MATCH#{MATCH_UUID}', 'SK': f'CHARACTER#{uuid}', 'id': cid, 'uuid': uuid,
            'userUuid': 'player-uuid-001', 'idLocation': location, 'dexterity': 3,
            'intelligence': 3, 'constitution': 3, 'life': 10, 'energy': 50, 'energyMax': 100,
            'lifeMax': 100, 'sadMax': 50, 'sad': 0, 'isSleeping': 0, 'isComa': 0,
            'weightMax': 30, 'food': 0, 'magic': 0, 'coin': 0}


@contextmanager
def _env(items):
    table = FakeTable(items)
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'player-uuid-001'}), patch_table(table):
        yield table


def _post(path, body=None):
    return make_event('POST', f'/api/gameplay/{MATCH_UUID}/{path}', body=body, headers=TOKEN,
                      path_params={'uuidMatch': MATCH_UUID})


# ── helpers ─────────────────────────────────────────────────────────────────

def test_time_start_weather_flags_the_change_and_resolves_the_card():
    story = _story()
    same = h._time_start_weather({'currentWeatherId': 1}, story, 1)
    assert same['changed'] is False and same['uuid'] == 'w-sun'
    assert same['card']['title'] == 'Sun'
    assert same['deltaEnergy'] == -1 and same['costMoveNotSafeLocation'] == 2
    assert h._time_start_weather({'currentWeatherId': 2}, story, 1)['changed'] is True
    assert h._time_start_weather({'currentWeatherId': 2}, story, None)['changed'] is True
    assert h._time_start_weather({'currentWeatherId': None}, story, 1) is None


def test_pop_time_end_strips_every_entry_and_keeps_the_first():
    fired = [{'a': 1}, {'_timeEnd': {'n': 1}}, {'_timeEnd': {'n': 2}}]
    assert h._pop_time_end(fired) == {'n': 1}
    assert all('_timeEnd' not in f for f in fired)
    assert h._pop_time_end(None) is None


# ── execute-event ───────────────────────────────────────────────────────────

def test_execute_event_that_ends_the_time_answers_counter_zero_and_weather():
    story = _story(events=[_event(50, 'evt-night', flagEndTime=1)])
    with _env([PLAYER, story, _match(counter=1), _char()]):
        body = _body(h.lambda_handler(_post('action/execute-event', {'eventUuid': 'evt-night'}),
                                      None))
    assert body['timeEnded'] is True
    assert [c['eventUuid'] for c in body['counterZero']] == ['evt-fuse']
    assert body['counterZero'][0]['trigger'] == _events.TRIGGER_COUNTER_ZERO
    assert body['weather']['uuid'] == 'w-sun'
    assert body['weather']['changed'] is False


def test_execute_event_after_a_scenario_switch_answers_a_changed_weather():
    story = _story(events=[_event(50, 'evt-night', flagEndTime=1)])
    rain = [{'key': 'scenario', 'stringValue': 'rain', 'multiValue': 0}]
    with _env([PLAYER, story, _match(registry=rain), _char()]):
        body = _body(h.lambda_handler(_post('action/execute-event', {'eventUuid': 'evt-night'}),
                                      None))
    assert body['weather']['changed'] is True
    assert body['weather']['idWeather'] == 2
    assert body['weather']['card']['title'] == 'Rain'


def test_execute_event_without_a_time_end_answers_null_and_empty():
    story = _story(events=[_event(51, 'evt-day')])
    with _env([PLAYER, story, _match(), _char()]):
        body = _body(h.lambda_handler(_post('action/execute-event', {'eventUuid': 'evt-day'}),
                                      None))
    assert body['timeEnded'] is False
    assert body['weather'] is None and body['counterZero'] == []


# ── select-choice ───────────────────────────────────────────────────────────

def _choice_story(**choice_over):
    choice = {'id': 20, 'uuid': 'ch-gift', 'idEvent': 32, 'priority': 1, 'otherwiseFlag': 0,
              'isProgress': 0, 'logicOperator': 'AND'}
    choice.update(choice_over)
    return _story(
        events=[_event(32, 'evt-fork', idCard=7), _event(33, 'evt-linked'),
                _event(36, 'evt-ender', flagEndTime=1)],
        effects=[{'id': 901, 'idEvent': 33, 'statistics': 'magic', 'value': 1,
                  'target': 'ONLY_ONE'}],
        choices=[choice],
        choice_effects=[
            {'id': 1, 'idChoices': 20, 'statistics': 'food', 'value': 2},
            {'id': 2, 'idChoices': 20, 'statistics': 'coin', 'value': 1, 'idEvent': 33},
            {'id': 3, 'idChoices': 20, 'statistics': 'energy', 'value': -3}])


def _open_cycle_match(**over):
    match = _match(**over)
    match['eventMarkers'] = {'32': {'executed': 1, 'selected': 0}}
    match['executedEventIds'] = [32]
    return match


def test_select_choice_writes_one_choice_row_with_the_options_own_gains():
    with _env([PLAYER, _choice_story(), _open_cycle_match(), _char()]) as table:
        body = _body(h.lambda_handler(_post('action/select-choice', {'choiceUuid': 'ch-gift'}),
                                      None))
        logs = h.lambda_handler(make_event(
            'GET', f'/api/matches/{MATCH_UUID}/logs', headers=TOKEN,
            path_params={'uuid': MATCH_UUID, 'uuidMatch': MATCH_UUID}), None)
    assert body['weather'] is None and body['counterZero'] == []
    rows = [r for r in table.logs(MATCH_UUID) if r['type'] == 'CHOICE']
    assert len(rows) == 1
    assert rows[0]['idEvent'] == 32
    assert rows[0]['foodGain'] == 2 and rows[0]['coinGain'] == 1
    assert rows[0]['magicGain'] == 0 and rows[0]['energyGain'] == 0
    linked = next(r for r in table.logs(MATCH_UUID) if r['type'] == 'EVENT' and r['idEvent'] == 33)
    assert linked['magicGain'] == 1
    entries = _body(logs)['logs']
    choice = next(e for e in entries if e['type'] == 'CHOICE')
    assert choice['card']['title'] == 'Crossroads'


def test_select_choice_that_ends_the_time_answers_the_news():
    story = _choice_story(idEventTorun=36)
    with _env([PLAYER, story, _open_cycle_match(counter=1), _char()]):
        body = _body(h.lambda_handler(_post('action/select-choice', {'choiceUuid': 'ch-gift'}),
                                      None))
    assert body['timeEnded'] is True
    assert [c['eventUuid'] for c in body['counterZero']] == ['evt-fuse']
    assert body['weather']['changed'] is False


# ── movement ────────────────────────────────────────────────────────────────

def test_an_arrival_event_that_ends_the_time_answers_the_news_on_the_move():
    story = _story(events=[_event(40, 'evt-dusk', type='AUTOMATIC', flagEndTime=1)],
                   loc_b={'idEventIfFirstTime': 40})
    with _env([PLAYER, story, _match(clock=2, counter=1), _char()]) as table:
        body = _body(h.lambda_handler(_post('movements/start', {'targetLocationUuid': 'loc-b'}),
                                      None))
        stored = table.get_item(f'MATCH#{MATCH_UUID}')
    assert body['timeEnded'] is True
    assert body['currentClock'] == 3 and stored['currentClock'] == 3
    assert body['weather']['uuid'] == 'w-sun'
    assert [c['eventUuid'] for c in body['counterZero']] == ['evt-fuse']
    assert all('_timeEnd' not in f for f in body['automaticEvents'])


def test_an_ordinary_move_answers_no_news():
    with _env([PLAYER, _story(), _match(), _char()]):
        body = _body(h.lambda_handler(_post('movements/start', {'targetLocationUuid': 'loc-b'}),
                                      None))
    assert body['timeEnded'] is False
    assert body['weather'] is None and body['counterZero'] == []


# ── resource gains of automatic events ──────────────────────────────────────

def test_a_counter_zero_event_logs_the_actors_food_on_its_row():
    with _env([PLAYER, _story(), _match(counter=1), _char()]) as table:
        h.lambda_handler(_post('action/sleep'), None)
    row = next(r for r in table.logs(MATCH_UUID) if r['type'] == 'EVENT' and r['idEvent'] == 777)
    assert row['foodGain'] == 1


def test_a_party_run_sums_every_recipients_gain_on_its_row():
    story = _story(events=[_event(70, 'evt-coins', type='AUTOMATIC')],
                   effects=[{'id': 902, 'idEvent': 70, 'statistics': 'coin', 'value': 1,
                             'target': 'ALL'}])
    items = [PLAYER, story, _match(), _char(), _char('c2', 2, LOC_B)]
    with _env(items):
        h._repo.begin()
        match = h._repo.match(MATCH_UUID)
        out = []
        h._run_automatic_event(match, MATCH_UUID, story, None, 70, 0,
                               _events.TRIGGER_RANDOM_EVENT, 'en', 0, out)
        row = next(r for r in pending_logs(match) if r['type'] == 'EVENT')
        h._repo.flush()
    assert row['characterUuid'] is None
    assert row['coinGain'] == 2
    assert '_timeEnd' not in out[0]
