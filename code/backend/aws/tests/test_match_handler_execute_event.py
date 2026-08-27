"""Coverage for the Step 29 route POST /api/gameplay/{uuidMatch}/action/execute-event.

The engine itself is covered by test_events.py; what is exercised here is the route's own
wiring — in particular the card resolution, which reads the story's raw_cards/raw_texts and
had been reading the (non-existent) 'cards'/'texts' keys, so every card came back null.

jwt_utils and db_utils are patched; no AWS calls are made.
"""
import json
from unittest.mock import patch

from helpers import make_event

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'guest', 'role': 'PLAYER'}

CHARACTER = {
    'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'userUuid': 'u1',
    'idLocation': 1, 'energy': 10, 'coin': 0, 'life': 10, 'exp': 0,
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
    ],
    'eventEffects': [
        {'id': 1, 'idEvent': 10, 'idCard': 1, 'statistics': 'exp', 'value': 5,
         'target': 'ONLY_ONE'},
    ],
    # The story stores its cards and texts under raw_cards/raw_texts.
    'raw_cards': [
        {'id': 1, 'uuid': 'card-1', 'cardType': 'story', 'idTextTitle': 201,
         'idTextDescription': 202, 'awesomeIcon': 'fa-scroll', 'urlImage': None},
    ],
    'raw_texts': [
        {'idText': 201, 'lang': 'en', 'shortText': 'Search the Hall'},
        {'idText': 201, 'lang': 'it', 'shortText': 'Cerca nella Sala'},
        {'idText': 202, 'lang': 'en', 'shortText': 'You search the hall.'},
        {'idText': 202, 'lang': 'it', 'shortText': 'Cerchi nella sala.'},
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


def _event(lang=None):
    path = '/api/gameplay/m1/action/execute-event'
    return make_event('POST', path, body={'eventUuid': 'evt-plain'},
                      headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                      path_params={'uuidMatch': 'm1'},
                      qs=({'lang': lang} if lang else None))


def _call(event):
    from match.handler import lambda_handler
    return lambda_handler(event, {})


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)])
@patch('match.handler.db_utils.get_item', side_effect=_get_side)
def test_execute_event_resolves_the_card_of_the_event_and_of_every_effect(_g, _q, _p, _jwt):
    result = _call(_event())
    assert result['statusCode'] == 200
    body = json.loads(result['body'])

    assert body['eventUuid'] == 'evt-plain'
    assert body['energySpent'] == 1

    # The event's own card, and — the narrative the board renders — each effect's own card.
    assert body['card'] is not None
    assert body['card']['title'] == 'Search the Hall'
    assert body['effects']
    for effect in body['effects']:
        assert effect['card'] is not None
        assert effect['card']['title'] == 'Search the Hall'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)])
@patch('match.handler.db_utils.get_item', side_effect=_get_side)
def test_execute_event_cards_follow_the_lang_parameter(_g, _q, _p, _jwt):
    body = json.loads(_call(_event(lang='it'))['body'])
    assert body['card']['title'] == 'Cerca nella Sala'
    assert body['effects'][0]['card']['title'] == 'Cerca nella Sala'


# ── v0.35.4: what the event gave, on its own log row ────────────────────────

_GIVING_STORY = {
    **STORY,
    'events': [
        {'id': 10, 'uuid': 'evt-plain', 'idSpecificLocation': 1, 'type': 'NORMAL',
         'idCard': 1, 'costEnery': 1, 'costCoin': 0, 'flagEndTime': 0},
    ],
    'eventEffects': [
        {'id': 1, 'idEvent': 10, 'idCard': 1, 'statistics': 'coin', 'value': 30,
         'target': 'ONLY_ONE'},
        {'id': 2, 'idEvent': 10, 'idCard': 1, 'statistics': 'food', 'value': 4,
         'target': 'ONLY_ONE'},
        {'id': 3, 'idEvent': 10, 'idCard': 1, 'statistics': 'magic', 'value': -2,
         'target': 'ONLY_ONE'},
    ],
}


def _giving_side(match_state):
    def inner(pk, sk='METADATA'):
        if pk.startswith('USER#'):
            return USER
        if pk.startswith('MATCH#'):
            return match_state
        if pk.startswith('STORY#'):
            return _GIVING_STORY
        return None
    return inner


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)])
def test_v0354_the_event_row_carries_the_gains_beside_the_price(_q, _p, _jwt):
    match = {**MATCH, 'coin': 0}
    with patch('match.handler.db_utils.get_item', side_effect=_giving_side(match)):
        assert _call(_event())['statusCode'] == 200

    row = match['eventLog'][-1]
    assert (row['energyCost'], row['coinCost']) == (1, 0)
    # Only the positive half: the drained magic is the effect's own business, not a gain.
    assert (row['coinGain'], row['foodGain']) == (30, 4)
    assert (row['energyGain'], row['magicGain']) == (0, 0)
