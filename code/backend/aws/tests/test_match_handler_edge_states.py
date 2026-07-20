"""Step 30 — edge states on POST /api/gameplay/{uuidMatch}/action/execute-event.

The rules themselves are covered by test_events.py; what is exercised here is the route
wiring: the coma stamp, the sadness discharge and the all-players-in-coma epilogue.

The roster is a single character on purpose: in single player that one coma IS the whole
party going down, which is the path this step has to get right first.

jwt_utils and db_utils are patched; no AWS calls are made.
"""
import json
from unittest.mock import patch

from helpers import make_event

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'guest',
        'role': 'PLAYER'}


def character(**over):
    """cos 10, life 30, sad 0/50, at location 1."""
    base = {
        'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'userUuid': 'u1',
        'idLocation': 1, 'energy': 10, 'coin': 0, 'life': 30, 'exp': 0,
        'sad': 0, 'sadMax': 50, 'lifeMax': 100, 'energyMax': 100, 'constitution': 10,
        'classUuid': 'cl1', 'isSleeping': 0, 'isComa': 0,
    }
    base.update(over)
    return base


MATCH = {
    'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
    'currentClock': 7, 'userCreatorUuid': 'u1', 'storyUuid': 's1',
}

_EVENTS = [
    {'id': 10, 'uuid': 'evt-kill', 'idSpecificLocation': 1, 'type': 'NORMAL',
     'idCard': 1, 'costEnery': 0, 'coinCost': 0, 'flagEndTime': 0},
    {'id': 20, 'uuid': 'evt-coma', 'type': 'NORMAL', 'idCard': 1,
     'costEnery': 0, 'coinCost': 0, 'flagEndTime': 0},
]

_CARDS = [{'id': 1, 'uuid': 'card-1', 'cardType': 'story', 'idTextTitle': 201,
           'idTextDescription': 202, 'awesomeIcon': 'fa-skull', 'urlImage': None}]
_TEXTS = [{'idText': 201, 'lang': 'en', 'shortText': 'The dark closes in'},
          {'idText': 202, 'lang': 'en', 'shortText': 'Everything fades.'}]


def story(effects, **over):
    base = {
        'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
        'events': _EVENTS, 'eventEffects': effects,
        'raw_cards': _CARDS, 'raw_texts': _TEXTS,
    }
    base.update(over)
    return base


def kill_effect(value=-9999, stat='life'):
    return [{'id': 1, 'idEvent': 10, 'idCard': 1, 'statistics': stat, 'value': value,
             'target': 'ONLY_ONE'}]


def run(the_story, the_character=None):
    """Drive execute-event with the given story and character, return the parsed body."""
    char = the_character or character()

    def _get_side(pk, sk='METADATA'):
        if pk.startswith('USER#'):
            return USER
        if pk.startswith('MATCH#'):
            return dict(MATCH)
        if pk.startswith('STORY#'):
            return the_story
        return None

    event = make_event('POST', '/api/gameplay/m1/action/execute-event',
                       body={'eventUuid': 'evt-kill'},
                       headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                       path_params={'uuidMatch': 'm1'})
    written = []
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'}), \
            patch('match.handler.db_utils.put_item', side_effect=written.append), \
            patch('match.handler.db_utils.query_by_pk', return_value=[char]), \
            patch('match.handler.db_utils.get_item', side_effect=_get_side):
        from match.handler import lambda_handler
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200, result
    return json.loads(result['body']), written


def party_rows(written):
    from match import events as _events
    for item in written:
        for row in item.get('eventLog') or []:
            if str(row.get('message') or '').startswith(_events.MSG_ALL_PLAYER_COMA):
                yield row


# ── coma ────────────────────────────────────────────────────────────────────

def test_life_at_zero_comas_and_stamps_the_clock():
    body, written = run(story(kill_effect()))

    assert body['comaTriggered'] is True
    assert body['edgeState']['comaUuids'] == ['c1']
    saved = [w for w in written if w.get('SK') == 'CHARACTER#c1'][0]
    assert saved['isComa'] == 1
    assert saved['isSleeping'] == 1
    # The Step 29 gap this step closes: the clock of the collapse is now recorded.
    assert saved['clockInComa'] == 7


def test_a_comatose_actor_cannot_execute_at_all():
    """This is what makes the coma stamp idempotent ACROSS requests.

    Nothing re-runs the rules on an already comatose actor, so clock_in_coma keeps the
    clock of the original collapse: the availability check rejects them first.
    """
    already = character(life=0, isComa=1, isSleeping=1, clockInComa=2)

    def _get_side(pk, sk='METADATA'):
        if pk.startswith('USER#'):
            return USER
        if pk.startswith('MATCH#'):
            return dict(MATCH)
        if pk.startswith('STORY#'):
            return story(kill_effect())
        return None

    event = make_event('POST', '/api/gameplay/m1/action/execute-event',
                       body={'eventUuid': 'evt-kill'},
                       headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                       path_params={'uuidMatch': 'm1'})
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'}), \
            patch('match.handler.db_utils.put_item'), \
            patch('match.handler.db_utils.query_by_pk', return_value=[already]), \
            patch('match.handler.db_utils.get_item', side_effect=_get_side):
        from match.handler import lambda_handler
        result = lambda_handler(event, {})

    assert result['statusCode'] == 409
    assert json.loads(result['body'])['error'] == 'COMA'


# ── sadness overflow ────────────────────────────────────────────────────────

def test_sadness_never_rests_at_its_cap():
    body, written = run(story(kill_effect(value=9999, stat='sad')))

    assert body['edgeState']['sadnessOverflowUuids'] == ['c1']
    assert body['comaTriggered'] is False  # life 30 - COS 10 = 20, still standing
    # An overflow forces sleep on its own, so forcedSleep cannot be derived from
    # comaTriggered — that omission was a real parity bug against Java and Python.
    assert body['forcedSleep'] is True
    saved = [w for w in written if w.get('SK') == 'CHARACTER#c1'][0]
    assert saved['sad'] == 0
    assert saved['life'] == 20
    assert saved['isSleeping'] == 1


def test_the_character_detail_projection_exposes_the_coma_clock():
    """The stamp is the headline of this step; unprojected it is unobservable."""
    from match.handler import _character_full, _character_summary
    item = {'uuid': 'c1', 'isComa': 1, 'clockInComa': 7}

    assert _character_full(item)['clockInComa'] == 7
    assert _character_summary(item)["clockInComa"] == 7


def test_an_overflow_that_empties_the_life_bar_also_comas():
    frail = character(life=8)
    body, written = run(story(kill_effect(value=9999, stat='sad')), frail)

    assert body['edgeState']['sadnessOverflowUuids'] == ['c1']
    assert body['edgeState']['comaUuids'] == ['c1']
    saved = [w for w in written if w.get('SK') == 'CHARACTER#c1'][0]
    assert saved['life'] == 0 and saved['isComa'] == 1


# ── the epilogue ────────────────────────────────────────────────────────────

def test_everyone_down_runs_the_epilogue_and_keeps_it_separate():
    body, written = run(story(kill_effect(), idEventAllPlayerComa=20))

    edge = body['edgeState']
    assert edge['allPlayersInComa'] is True
    assert edge['comaEventUuid'] == 'evt-coma'
    assert edge['comaEventCard']['title'] == 'The dark closes in'
    assert edge['comaExecutedEventUuids'] == ['evt-coma']
    # The player's own chain must not contain the epilogue.
    assert body['executedEventUuids'] == ['evt-kill']
    assert len(list(party_rows(written))) == 1


def test_the_match_is_not_moved_to_gameover():
    body, written = run(story(kill_effect(), idEventAllPlayerComa=20))

    # GAMEOVER is step 59; the flag here is driven only by idEventEndGame.
    assert body['gameOver'] is False
    saved_match = [w for w in written if w.get('SK') == 'METADATA']
    assert all(m.get('status') == 'RUNNING' for m in saved_match)


def test_a_story_with_no_authored_epilogue_still_logs_the_collapse():
    body, written = run(story(kill_effect()))

    assert body['edgeState']['allPlayersInComa'] is True
    assert body['edgeState']['comaEventUuid'] is None
    assert len(list(party_rows(written))) == 1


def test_a_dangling_epilogue_id_is_authored_noise():
    body, _ = run(story(kill_effect(), idEventAllPlayerComa=999))

    assert body['edgeState']['allPlayersInComa'] is True
    assert body['edgeState']['comaEventUuid'] is None


def test_a_quiet_execution_leaves_the_edge_state_empty():
    body, _ = run(story(kill_effect(value=-1)))

    edge = body['edgeState']
    assert edge['comaUuids'] == []
    assert edge['sadnessOverflowUuids'] == []
    assert edge['allPlayersInComa'] is False
    assert edge['comaEventUuid'] is None
