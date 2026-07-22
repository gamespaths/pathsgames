"""Step 31 — the CHOICES_PENDING branch of POST /api/gameplay/{uuidMatch}/action/execute-event.

The verdict matrix is covered by test_choices.py; what is exercised here is the route's
own wiring: the branch, the pay-and-mark on first open, the idempotent re-fetch and the
APPLIED regression. jwt_utils and db_utils are patched; no AWS calls are made.
"""
import json
from unittest.mock import patch

from helpers import make_event

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'guest', 'role': 'PLAYER'}

CHARACTER = {
    'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'userUuid': 'u1',
    'idLocation': 1, 'energy': 10, 'coin': 0, 'life': 10, 'exp': 0,
    'dexterity': 3, 'intelligence': 3, 'constitution': 3, 'sad': 0,
    'classUuid': 'cl1', 'isSleeping': 0, 'isComa': 0,
}

MATCH = {
    'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
    'currentClock': 1, 'userCreatorUuid': 'u1', 'storyUuid': 's1',
}

STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
    'events': [
        {'id': 10, 'uuid': 'evt-plain', 'idSpecificLocation': 1, 'type': 'NORMAL',
         'idCard': 1, 'costEnery': 1, 'coinCost': 0, 'flagEndTime': 0},
        # flagEndTime and an effect that must NEVER run while pending.
        {'id': 30, 'uuid': 'evt-choices', 'idSpecificLocation': 1, 'type': 'NORMAL',
         'idCard': 1, 'costEnery': 1, 'coinCost': 0, 'flagEndTime': 1},
        {'id': 31, 'uuid': 'evt-choices-once', 'idSpecificLocation': 1, 'type': 'ONCE',
         'idCard': 1, 'costEnery': 1, 'coinCost': 0, 'flagEndTime': 0},
    ],
    'eventEffects': [
        {'id': 1, 'idEvent': 10, 'idCard': 1, 'statistics': 'exp', 'value': 5,
         'target': 'ONLY_ONE'},
        {'id': 2, 'idEvent': 30, 'idCard': 1, 'statistics': 'exp', 'value': 99,
         'target': 'ONLY_ONE'},
    ],
    'choices': [
        {'id': 11, 'uuid': 'ch-gated', 'idEvent': 30, 'priority': 1, 'idCard': 1,
         'idTextName': 613, 'otherwiseFlag': 0, 'logicOperator': 'AND'},
        {'id': 10, 'uuid': 'ch-plain', 'idEvent': 30, 'priority': 2, 'idCard': 1,
         'idTextName': 612, 'otherwiseFlag': 0, 'logicOperator': 'AND'},
        {'id': 14, 'uuid': 'ch-once', 'idEvent': 31, 'priority': 1,
         'idTextName': 612, 'otherwiseFlag': 0, 'logicOperator': 'AND'},
    ],
    'choiceConditions': [
        {'id': 1, 'idChoices': 11, 'type': 'statistics', 'key': 'int',
         'value': '99', 'operator': '>'},
    ],
    'choiceEffects': [
        {'id': 1, 'idChoices': 10, 'statistics': 'energy', 'value': 1},
    ],
    'raw_cards': [
        {'id': 1, 'uuid': 'card-1', 'cardType': 'story', 'idTextTitle': 201,
         'idTextDescription': 202, 'awesomeIcon': 'fa-scroll', 'urlImage': None},
    ],
    'raw_texts': [
        {'idText': 201, 'lang': 'en', 'shortText': 'A Card'},
        {'idText': 612, 'lang': 'en', 'shortText': 'Take the plain road'},
        {'idText': 612, 'lang': 'it', 'shortText': 'Prendi la via semplice'},
        {'idText': 613, 'lang': 'en', 'shortText': 'Recite the ancient runes'},
    ],
}


def _get_side(pk, sk='METADATA'):
    if pk.startswith('USER#'):
        return USER
    if pk.startswith('MATCH#'):
        return dict(MATCH)
    if pk.startswith('STORY#'):
        return STORY
    return None


def _get_side_open_cycle(pk, sk='METADATA'):
    """The match already carries one EVENT_EXECUTED marker for event 30 — an open cycle."""
    if pk.startswith('MATCH#'):
        return {**MATCH, 'eventLog': [
            {'characterUuid': 'c1', 'idEvent': 30, 'clock': 1,
             'message': 'EVENT_EXECUTED 30'}]}
    return _get_side(pk, sk)


def _event(event_uuid, lang=None):
    return make_event('POST', '/api/gameplay/m1/action/execute-event',
                      body={'eventUuid': event_uuid},
                      headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                      path_params={'uuidMatch': 'm1'},
                      qs=({'lang': lang} if lang else None))


def _call(event):
    from match.handler import lambda_handler
    return lambda_handler(event, {})


def _jwt():
    return patch('match.handler.jwt_utils.verify_access_token',
                 return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})


def test_no_choice_event_answers_applied():
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item'):
        result = _call(_event('evt-plain'))
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['status'] == 'APPLIED'
    assert body['pendingChoices'] == []
    assert body['effects']


def test_first_open_pays_marks_and_presents():
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item') as put_item:
        result = _call(_event('evt-choices'))

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['status'] == 'CHOICES_PENDING'
    assert body['energySpent'] == 1 and body['newEnergy'] == 9
    assert body['executedEventUuids'] == ['evt-choices']
    # Presenting REPLACES applying: no effects, no stat changes, no time end, no gameOver.
    assert body['effects'] == [] and body['statChanges'] == []
    assert body['timeEnded'] is False and body['gameOver'] is False
    assert body['edgeState']['comaUuids'] == []

    # Sorted by priority; the gated option is surfaced disabled, never dropped.
    first, second = body['pendingChoices']
    assert first['uuid'] == 'ch-gated' and first['available'] is False
    assert first['reason'] == 'CONDITION_STATISTICS_NOT_MET'
    assert first['name'] == 'Recite the ancient runes'
    assert second['uuid'] == 'ch-plain' and second['available'] is True
    assert second['reason'] is None
    assert second['card']['title'] == 'A Card'

    # Exactly two writes — the paid caller and the marked match, one marker row.
    put_calls = [c.args[0] for c in put_item.call_args_list]
    assert len(put_calls) == 2
    caller_item = next(i for i in put_calls if i.get('SK', '').startswith('CHARACTER#'))
    match_item = next(i for i in put_calls if i.get('SK') == 'METADATA')
    assert caller_item['energy'] == 9
    markers = [e for e in match_item['eventLog']
               if str(e.get('message', '')).startswith('EVENT_EXECUTED')]
    assert len(markers) == 1 and markers[0]['idEvent'] == 30


def test_open_cycle_serves_again_without_charging_or_writing():
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side_open_cycle), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item') as put_item:
        result = _call(_event('evt-choices'))

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['status'] == 'CHOICES_PENDING'
    assert body['energySpent'] == 0 and body['newEnergy'] == 10
    assert body['executedEventUuids'] == ['evt-choices']
    assert len(body['pendingChoices']) == 2
    put_item.assert_not_called()


def test_open_cycle_bypasses_the_verdict_for_a_spent_once():
    def broke_open(pk, sk='METADATA'):
        if pk.startswith('MATCH#'):
            return {**MATCH, 'eventLog': [
                {'characterUuid': 'c1', 'idEvent': 31, 'clock': 1,
                 'message': 'EVENT_EXECUTED 31'}]}
        return _get_side(pk, sk)

    # Energy 0: the verdict would also reject NOT_ENOUGH_ENERGY — both bypassed.
    broke = {**CHARACTER, 'energy': 0}
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=broke_open), \
         patch('match.handler.db_utils.query_by_pk', return_value=[broke]), \
         patch('match.handler.db_utils.put_item') as put_item:
        result = _call(_event('evt-choices-once'))

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['status'] == 'CHOICES_PENDING' and body['energySpent'] == 0
    put_item.assert_not_called()


def test_closed_cycle_of_a_once_event_is_spent():
    def closed(pk, sk='METADATA'):
        if pk.startswith('MATCH#'):
            return {**MATCH, 'eventLog': [
                {'characterUuid': 'c1', 'idEvent': 31, 'clock': 1,
                 'message': 'EVENT_EXECUTED 31'},
                {'characterUuid': 'c1', 'idEvent': 31, 'clock': 1,
                 'message': 'CHOICE_SELECTED 31'}]}
        return _get_side(pk, sk)

    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=closed), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item'):
        result = _call(_event('evt-choices-once'))

    assert result['statusCode'] == 409
    assert json.loads(result['body'])['error'] == 'ONCE_ALREADY_CONSUMED'


def test_first_open_of_an_unavailable_event_is_rejected():
    broke = {**CHARACTER, 'energy': 0}
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=[broke]), \
         patch('match.handler.db_utils.put_item') as put_item:
        result = _call(_event('evt-choices'))

    assert result['statusCode'] == 409
    assert json.loads(result['body'])['error'] == 'NOT_ENOUGH_ENERGY'
    put_item.assert_not_called()
