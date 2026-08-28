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


# ── the epilogue after a CHOICE — v0.35.6 ───────────────────────────────────
#
# A lethal OPTION puts the party down exactly as a lethal event does. Until v0.35.6 only
# execute-event resolved the epilogue, so a story whose killing blow was a choice never
# ran it: java and python did, AWS did not.

_CHOICE_EVENTS = [
    {'id': 30, 'uuid': 'evt-fork', 'idSpecificLocation': 1, 'type': 'NORMAL',
     'idCard': 1, 'costEnery': 0, 'coinCost': 0, 'flagEndTime': 0},
    # The epilogue, and the second link of its own chain.
    {'id': 20, 'uuid': 'evt-coma', 'type': 'NORMAL', 'idCard': 1, 'costEnery': 0,
     'coinCost': 0, 'flagEndTime': 0, 'idEventNext': 21},
    {'id': 21, 'uuid': 'evt-coma-next', 'type': 'NORMAL', 'idCard': 1, 'costEnery': 0,
     'coinCost': 0, 'flagEndTime': 0},
    # The option's outcome event: a comatose character never acts it out.
    {'id': 34, 'uuid': 'evt-outcome', 'type': 'NORMAL', 'idCard': 1, 'costEnery': 0,
     'coinCost': 0, 'flagEndTime': 0},
]

_CHOICE_EVENT_EFFECTS = [
    # The epilogue moves the body somewhere else — the whole point of authoring one.
    {'id': 50, 'idEvent': 20, 'idCard': 1, 'idLocation': 3, 'target': 'ONLY_ONE'},
    {'id': 51, 'idEvent': 21, 'idCard': 1, 'statistics': 'exp', 'value': 4,
     'target': 'ONLY_ONE'},
    {'id': 52, 'idEvent': 34, 'idCard': 1, 'statistics': 'exp', 'value': 7,
     'target': 'ONLY_ONE'},
]


def choice_story(**over):
    base = {
        'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
        'locations': [{'id': 1, 'uuid': 'loc-1'}, {'id': 3, 'uuid': 'loc-3'}],
        'locationNeighbors': [],
        'items': [],
        'events': _CHOICE_EVENTS,
        'eventEffects': _CHOICE_EVENT_EFFECTS,
        'choices': [
            {'id': 40, 'uuid': 'ch-fatal', 'idEvent': 30, 'priority': 1, 'idCard': 1,
             'idTextName': 201, 'otherwiseFlag': 0, 'isProgress': 0,
             'logicOperator': 'AND', 'idEventTorun': 34},
            {'id': 41, 'uuid': 'ch-safe', 'idEvent': 30, 'priority': 2, 'idCard': 1,
             'idTextName': 201, 'otherwiseFlag': 0, 'isProgress': 0,
             'logicOperator': 'AND'},
        ],
        'choiceConditions': [],
        'choiceEffects': [
            {'id': 40, 'idChoices': 40, 'idCard': 1, 'statistics': 'life', 'value': -9999},
            {'id': 41, 'idChoices': 41, 'idCard': 1, 'statistics': 'exp', 'value': 1},
        ],
        'raw_cards': _CARDS, 'raw_texts': _TEXTS,
    }
    base.update(over)
    return base


def resolve(the_story, choice_uuid='ch-fatal', characters=None):
    """Drive select-choice on an OPEN cycle for event 30, return (body, written rows)."""
    chars = characters if characters is not None else [character()]
    open_cycle = {**MATCH, 'eventLog': [
        {'characterUuid': 'c1', 'idEvent': 30, 'clock': 7, 'message': 'EVENT_EXECUTED 30'}]}

    def _get_side(pk, sk='METADATA'):
        if pk.startswith('USER#'):
            return USER
        if pk.startswith('MATCH#'):
            return dict(open_cycle)
        if pk.startswith('STORY#'):
            return the_story
        return None

    event = make_event('POST', '/api/gameplay/m1/action/select-choice',
                       body={'choiceUuid': choice_uuid},
                       headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                       path_params={'uuidMatch': 'm1'})
    written = []
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'}), \
            patch('match.handler.db_utils.put_item', side_effect=written.append), \
            patch('match.handler.db_utils.query_by_pk', return_value=chars), \
            patch('match.handler.db_utils.get_item', side_effect=_get_side):
        from match.handler import lambda_handler
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200, result
    return json.loads(result['body']), written


def test_a_lethal_option_runs_the_epilogue():
    body, written = resolve(choice_story(idEventAllPlayerComa=20))

    edge = body['edgeState']
    assert body['comaTriggered'] is True
    assert edge['comaUuids'] == ['c1']
    assert edge['allPlayersInComa'] is True
    assert edge['comaEventUuid'] == 'evt-coma'
    assert edge['comaEventCard']['title'] == 'The dark closes in'
    assert len(list(party_rows(written))) == 1


def test_the_epilogue_chain_runs_past_the_coma_that_opened_it():
    """The chain unwinds on a coma — except when the chain IS the epilogue."""
    body, written = resolve(choice_story(idEventAllPlayerComa=20))

    assert body['edgeState']['comaExecutedEventUuids'] == ['evt-coma', 'evt-coma-next']
    saved = [w for w in written if w.get('SK') == 'CHARACTER#c1'][0]
    assert saved['exp'] == 4


def test_the_epilogue_moves_the_body_and_says_so():
    body, written = resolve(choice_story(idEventAllPlayerComa=20))

    moves = [m for m in body['locationChanges'] if m['characterUuid'] == 'c1']
    assert moves and moves[0]['toLocationUuid'] == 'loc-3'
    assert body['movementApplied'] is True
    saved = [w for w in written if w.get('SK') == 'CHARACTER#c1'][0]
    assert saved['idLocation'] == 3


def test_the_epilogue_stays_out_of_the_option_s_own_chain():
    body, _ = resolve(choice_story(idEventAllPlayerComa=20))

    # The outcome event never ran (the actor is down), so the option's chain is empty and
    # everything executed belongs to the epilogue.
    assert body['executedEventUuids'] == []
    assert 'evt-outcome' not in body['edgeState']['comaExecutedEventUuids']
    # The option's own effect row stays on top; the epilogue's ride on comaEffects.
    assert [e['effectUuid'] for e in body['effects']] == [None]
    assert [e['eventUuid'] for e in body['edgeState']['comaEffects']] \
        == ['evt-coma', 'evt-coma-next']


def test_an_option_that_kills_without_an_authored_epilogue_still_logs_the_collapse():
    body, written = resolve(choice_story())

    assert body['edgeState']['allPlayersInComa'] is True
    assert body['edgeState']['comaEventUuid'] is None
    assert body['edgeState']['comaExecutedEventUuids'] == []
    assert len(list(party_rows(written))) == 1


def test_a_dangling_epilogue_id_on_a_choice_is_authored_noise():
    body, _ = resolve(choice_story(idEventAllPlayerComa=999))

    assert body['edgeState']['allPlayersInComa'] is True
    assert body['edgeState']['comaEventUuid'] is None


def test_a_once_epilogue_already_spent_does_not_fire_again():
    once = choice_story(idEventAllPlayerComa=20)
    once['events'] = [{**e, 'type': 'ONCE'} if e['id'] == 20 else e for e in _CHOICE_EVENTS]
    chars = [character()]
    open_cycle_log = [
        {'characterUuid': 'c1', 'idEvent': 30, 'clock': 7, 'message': 'EVENT_EXECUTED 30'},
        {'characterUuid': 'c1', 'idEvent': 20, 'clock': 3, 'message': 'EVENT_EXECUTED 20'}]

    def _get_side(pk, sk='METADATA'):
        if pk.startswith('USER#'):
            return USER
        if pk.startswith('MATCH#'):
            return {**MATCH, 'eventLog': list(open_cycle_log)}
        if pk.startswith('STORY#'):
            return once
        return None

    event = make_event('POST', '/api/gameplay/m1/action/select-choice',
                       body={'choiceUuid': 'ch-fatal'},
                       headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                       path_params={'uuidMatch': 'm1'})
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'}), \
            patch('match.handler.db_utils.put_item'), \
            patch('match.handler.db_utils.query_by_pk', return_value=chars), \
            patch('match.handler.db_utils.get_item', side_effect=_get_side):
        from match.handler import lambda_handler
        result = lambda_handler(event, {})

    edge = json.loads(result['body'])['edgeState']
    assert edge['allPlayersInComa'] is True
    assert edge['comaEventUuid'] is None


def test_one_player_down_out_of_two_is_not_the_party():
    companion = character(**{'SK': 'CHARACTER#c2', 'uuid': 'c2', 'userUuid': 'u2'})
    body, written = resolve(choice_story(idEventAllPlayerComa=20),
                            characters=[character(), companion])

    assert body['edgeState']['comaUuids'] == ['c1']
    assert body['edgeState']['allPlayersInComa'] is False
    assert body['edgeState']['comaEventUuid'] is None
    assert list(party_rows(written)) == []


def test_a_harmless_option_leaves_the_edge_state_empty():
    body, _ = resolve(choice_story(idEventAllPlayerComa=20), choice_uuid='ch-safe')

    edge = body['edgeState']
    assert edge['comaUuids'] == [] and edge['allPlayersInComa'] is False
    assert edge['comaEventUuid'] is None and edge['comaEffects'] == []
    assert body['comaTriggered'] is False


def test_the_epilogue_s_move_is_an_arrival_like_any_other():
    """v0.35.6 — a forced move is an arrival, and arriving is a trigger. AWS drained these
    nowhere on select-choice; java and python always did."""
    story = choice_story(idEventAllPlayerComa=20)
    story['locations'] = [{'id': 1, 'uuid': 'loc-1'},
                          {'id': 3, 'uuid': 'loc-3', 'idEventIfFirstTime': 60}]
    story['events'] = _CHOICE_EVENTS + [
        {'id': 60, 'uuid': 'evt-welcome', 'type': 'AUTOMATIC', 'idCard': 1, 'costEnery': 0,
         'coinCost': 0, 'flagEndTime': 0}]
    story['eventEffects'] = _CHOICE_EVENT_EFFECTS + [
        {'id': 60, 'idEvent': 60, 'idCard': 1, 'statistics': 'exp', 'value': 3,
         'target': 'ONLY_ONE'}]

    body, written = resolve(story)

    assert body['edgeState']['comaEventUuid'] == 'evt-coma'
    logged = [row.get('idEvent') for w in written if w.get('SK') == 'METADATA'
              for row in (w.get('eventLog') or [])]
    assert 60 in logged, 'the destination the epilogue carried the body to never fired'
    # And the epilogue is spent: that arrival must not run it a second time on a party
    # that is, of course, still entirely down. Counted on the FINAL match snapshot: the
    # same dict is written several times, so party_rows(written) would count it once per
    # write rather than once per row.
    from match import events as _events
    final = [w for w in written if w.get('SK') == 'METADATA'][-1]
    party = [r for r in final.get('eventLog') or []
             if str(r.get('message') or '').startswith(_events.MSG_ALL_PLAYER_COMA)]
    assert len(party) == 1
