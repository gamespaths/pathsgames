"""Step 32 — POST /api/gameplay/{uuidMatch}/action/select-choice.

Mirrors EventExecutionServiceSelectChoiceTest (Java) and test_event_service_select_choice
(Python). The three things worth proving, because getting any of them wrong is silent:
that resolution charges nothing (the open already paid), that it is gated on the cycle
really being open (the cost-bypass guard), and that a choice effect reaches the world
through the very same helpers an event effect does.

jwt_utils and db_utils are patched; no AWS calls are made.
"""
import json
from unittest.mock import patch

from helpers import make_event

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'guest', 'role': 'PLAYER'}

CHARACTER = {
    'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'userUuid': 'u1',
    'idLocation': 1, 'energy': 10, 'coin': 4, 'life': 10, 'exp': 0,
    'dexterity': 3, 'intelligence': 3, 'constitution': 3, 'sad': 0,
    'classUuid': 'cl1', 'isSleeping': 0, 'isComa': 0,
}

COMPANION = {**CHARACTER, 'SK': 'CHARACTER#c2', 'uuid': 'c2', 'userUuid': 'u2'}
FAR_AWAY = {**CHARACTER, 'SK': 'CHARACTER#c3', 'uuid': 'c3', 'userUuid': 'u3',
            'idLocation': 3}

MATCH = {
    'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
    'currentClock': 1, 'userCreatorUuid': 'u1', 'storyUuid': 's1',
}

STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
    'locations': [{'id': 1, 'uuid': 'loc-1'}, {'id': 3, 'uuid': 'loc-3'}],
    'items': [{'id': 1, 'uuid': 'item-1'}],
    'events': [
        {'id': 32, 'uuid': 'evt-owner', 'idSpecificLocation': 1, 'type': 'NORMAL',
         'idCard': 1, 'costEnery': 3, 'coinCost': 2, 'flagEndTime': 0},
        # The outcome event: cost 9 proves a consequence is never charged for.
        {'id': 33, 'uuid': 'evt-outcome', 'type': 'NORMAL', 'idCard': 1,
         'costEnery': 9, 'coinCost': 9, 'flagEndTime': 0},
        {'id': 34, 'uuid': 'evt-linked', 'type': 'NORMAL', 'idCard': 1,
         'costEnery': 0, 'coinCost': 0, 'flagEndTime': 0},
        # A choice-event a resolution can chain into.
        {'id': 35, 'uuid': 'evt-nested', 'type': 'NORMAL', 'idCard': 1,
         'costEnery': 9, 'coinCost': 0, 'flagEndTime': 0},
        {'id': 36, 'uuid': 'evt-ender', 'type': 'NORMAL', 'idCard': 1,
         'costEnery': 0, 'coinCost': 0, 'flagEndTime': 1},
    ],
    'eventEffects': [
        {'id': 1, 'idEvent': 33, 'idCard': 1, 'statistics': 'exp', 'value': 7,
         'target': 'ONLY_ONE'},
        {'id': 2, 'idEvent': 34, 'idCard': 1, 'statistics': 'exp', 'value': 2,
         'target': 'ONLY_ONE'},
    ],
    'choices': [
        {'id': 20, 'uuid': 'ch-plain', 'idEvent': 32, 'priority': 1, 'idCard': 1,
         'idTextName': 618, 'idTextNarrative': 620, 'otherwiseFlag': 0,
         'isProgress': 0, 'logicOperator': 'AND'},
        {'id': 21, 'uuid': 'ch-progress', 'idEvent': 32, 'priority': 2, 'idCard': 1,
         'idTextName': 618, 'otherwiseFlag': 0, 'isProgress': 1, 'logicOperator': 'AND'},
        {'id': 22, 'uuid': 'ch-locked', 'idEvent': 32, 'priority': 3, 'idCard': 1,
         'idTextName': 613, 'otherwiseFlag': 0, 'isProgress': 0, 'logicOperator': 'AND',
         'limitDex': 99},
        {'id': 23, 'uuid': 'ch-world', 'idEvent': 32, 'priority': 4, 'idCard': 1,
         'idTextName': 619, 'otherwiseFlag': 0, 'isProgress': 0, 'logicOperator': 'AND',
         'idEventTorun': 33},
        {'id': 24, 'uuid': 'ch-nested', 'idEvent': 32, 'priority': 5, 'idCard': 1,
         'idTextName': 619, 'otherwiseFlag': 0, 'isProgress': 0, 'logicOperator': 'AND',
         'idEventTorun': 35},
        {'id': 25, 'uuid': 'ch-ender', 'idEvent': 32, 'priority': 6, 'idCard': 1,
         'idTextName': 619, 'otherwiseFlag': 0, 'isProgress': 0, 'logicOperator': 'AND',
         'idEventTorun': 36},
        # An option of the nested choice-event, so 35 really owns choices.
        {'id': 26, 'uuid': 'ch-nested-inner', 'idEvent': 35, 'priority': 1,
         'idTextName': 618, 'otherwiseFlag': 1, 'isProgress': 0, 'logicOperator': 'AND'},
        # An orphan: R8 forbids it on import, but the CRUD path is lenient.
        {'id': 27, 'uuid': 'ch-orphan', 'idEvent': 999, 'priority': 1,
         'otherwiseFlag': 1, 'isProgress': 0, 'logicOperator': 'AND'},
    ],
    'choiceConditions': [],
    'choiceEffects': [
        {'id': 20, 'idChoices': 20, 'idCard': 1, 'statistics': 'exp', 'value': 5},
        # Everything at once: registry, item, forced move, weather, and an inline event.
        {'id': 23, 'idChoices': 23, 'idCard': 1, 'key': 'STEP32_GATE',
         'valueToAdd': 'OPEN', 'idItemTarget': 1, 'itemAction': 'ADD',
         'idLocation': 3, 'idWeather': 3, 'idEvent': 34},
    ],
    'raw_cards': [
        {'id': 1, 'uuid': 'card-1', 'cardType': 'story', 'idTextTitle': 201,
         'idTextDescription': 202, 'awesomeIcon': 'fa-scroll', 'urlImage': None},
    ],
    'raw_texts': [
        {'idText': 201, 'lang': 'en', 'shortText': 'A Card'},
        {'idText': 613, 'lang': 'en', 'shortText': 'Recite the ancient runes'},
        {'idText': 618, 'lang': 'en', 'shortText': 'Press on alone'},
        {'idText': 619, 'lang': 'en', 'shortText': 'Follow the lantern'},
        {'idText': 620, 'lang': 'en', 'shortText': 'The fork closes behind you.'},
        {'idText': 620, 'lang': 'it', 'shortText': 'Il bivio si chiude alle tue spalle.'},
    ],
}


def _match(event_log=None):
    """The match with an open cycle for event 32 unless told otherwise."""
    log = [{'characterUuid': 'c1', 'idEvent': 32, 'clock': 1,
            'message': 'EVENT_EXECUTED 32'}] if event_log is None else event_log
    return {**MATCH, 'eventLog': log}


def _get_side(pk, sk='METADATA'):
    if pk.startswith('USER#'):
        return USER
    if pk.startswith('MATCH#'):
        return _match()
    if pk.startswith('STORY#'):
        return STORY
    return None


def _get_side_with(match):
    def side(pk, sk='METADATA'):
        if pk.startswith('MATCH#'):
            return match
        return _get_side(pk, sk)
    return side


def _event(choice_uuid, lang=None):
    return make_event('POST', '/api/gameplay/m1/action/select-choice',
                      body={'choiceUuid': choice_uuid},
                      headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                      path_params={'uuidMatch': 'm1'},
                      qs=({'lang': lang} if lang else None))


def _call(event):
    from match.handler import lambda_handler
    return lambda_handler(event, {})


def _jwt():
    return patch('match.handler.jwt_utils.verify_access_token',
                 return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})


def _resolve(choice_uuid, *, characters=None, get_side=None, lang=None):
    chars = characters if characters is not None else [dict(CHARACTER)]
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=get_side or _get_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=chars), \
         patch('match.handler.db_utils.put_item'):
        return _call(_event(choice_uuid, lang))


def _body(result):
    return json.loads(result['body'])


# ── the guards ──────────────────────────────────────────────────────────────

def test_unknown_option_is_not_found():
    result = _resolve('nope')
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'CHOICE_NOT_FOUND'


def test_missing_choice_uuid_is_a_bad_request():
    for body in ({}, {'choiceUuid': '  '}):
        event = make_event('POST', '/api/gameplay/m1/action/select-choice', body=body,
                           headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                           path_params={'uuidMatch': 'm1'})
        with _jwt(), patch('match.handler.db_utils.get_item', side_effect=_get_side):
            result = _call(event)
        assert result['statusCode'] == 400
        assert _body(result)['error'] == 'MISSING_CHOICE'


def test_option_whose_owning_event_is_missing_is_rejected():
    result = _resolve('ch-orphan')
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'EVENT_NOT_FOUND'


def test_match_not_running_is_rejected():
    result = _resolve('ch-plain',
                      get_side=_get_side_with({**_match(), 'status': 'PAUSED'}))
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'MATCH_NOT_RUNNING'


def test_coma_outranks_sleep():
    comatose = [{**CHARACTER, 'isComa': 1, 'isSleeping': 1}]
    result = _resolve('ch-plain', characters=comatose)
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'COMA'


def test_sleeping_character_cannot_resolve():
    result = _resolve('ch-plain', characters=[{**CHARACTER, 'isSleeping': 1}])
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'SLEEPING'


def test_event_never_opened_has_no_cycle_to_close():
    """The cost-bypass guard: no open, no resolution."""
    result = _resolve('ch-plain', get_side=_get_side_with(_match(event_log=[])))
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'CHOICE_NOT_OPEN'


def test_resolving_twice_is_rejected():
    balanced = _match(event_log=[
        {'characterUuid': 'c1', 'idEvent': 32, 'clock': 1, 'message': 'EVENT_EXECUTED 32'},
        {'characterUuid': 'c1', 'idEvent': 32, 'clock': 1, 'message': 'CHOICE_SELECTED 32'},
    ])
    result = _resolve('ch-plain', get_side=_get_side_with(balanced))
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'CHOICE_NOT_OPEN'


def test_option_that_became_unavailable_is_rejected():
    result = _resolve('ch-locked')
    assert result['statusCode'] == 409
    body = _body(result)
    assert body['error'] == 'CHOICE_NOT_AVAILABLE'
    # The message names the checker's own reason, so the board can say why.
    assert 'LIMIT_DEX_NOT_MET' in body['message']


def test_a_rejected_resolution_writes_nothing():
    with _jwt(), \
         patch('match.handler.db_utils.get_item',
               side_effect=_get_side_with(_match(event_log=[]))), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item') as put_item:
        result = _call(_event('ch-plain'))

    assert result['statusCode'] == 409
    put_item.assert_not_called()


# ── it charges nothing ──────────────────────────────────────────────────────

def test_resolution_charges_nothing():
    """The open already paid the energy and the coins; this is what that bought."""
    body = _body(_resolve('ch-plain'))

    assert body['energySpent'] == 0 and body['coinSpent'] == 0
    assert body['newEnergy'] == 10 and body['newCoin'] == 4


# ── the markers that close the cycle ────────────────────────────────────────

def test_the_cycle_is_closed_and_the_history_recorded():
    match = _match()
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side_with(match)), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item'):
        _call(_event('ch-plain'))

    # The marker carries the OWNING EVENT's id, never the option's — count_log_markers
    # pairs the two by event, and a choice id would leave the cycle open for ever.
    assert match['eventLog'][-1]['idEvent'] == 32
    assert match['eventLog'][-1]['message'] == 'CHOICE_SELECTED 32'
    row = match['choiceLog'][-1]
    assert row['idEvent'] == 32 and row['idChoise'] == 20


def test_ordinary_option_records_no_milestone():
    match = _match()
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side_with(match)), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item'):
        result = _call(_event('ch-plain'))

    assert _body(result)['progressRecorded'] is False
    assert 'storyProgress' not in match


def test_is_progress_option_records_the_milestone():
    match = _match()
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side_with(match)), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item'):
        result = _call(_event('ch-progress'))

    assert _body(result)['progressRecorded'] is True
    assert match['storyProgress'][-1]['idEvent'] == 32
    assert match['storyProgress'][-1]['idChoise'] == 21


# ── the narrative, revealed at last ─────────────────────────────────────────

def test_reveals_the_narrative_step31_withheld():
    body = _body(_resolve('ch-plain'))

    assert body['narrative'] == 'The fork closes behind you.'
    assert body['choiceUuid'] == 'ch-plain'
    assert body['eventUuid'] == 'evt-owner'  # the event that OWNED the option
    assert body['choiceCard']['title'] == 'A Card'


def test_the_narrative_follows_the_requested_lang():
    body = _body(_resolve('ch-plain', lang='it'))

    assert body['narrative'] == 'Il bivio si chiude alle tue spalle.'


# ── the effects ─────────────────────────────────────────────────────────────

def test_a_stat_effect_moves_the_stat():
    body = _body(_resolve('ch-plain'))

    assert body['status'] == 'APPLIED'
    change = next(c for c in body['statChanges'] if c['statistic'] == 'exp')
    assert change['before'] == 0 and change['after'] == 5
    assert body['effects'][0]['card']['title'] == 'A Card'


def test_flag_group_zero_touches_the_actor_alone():
    body = _body(_resolve('ch-plain',
                          characters=[dict(CHARACTER), dict(COMPANION)]))

    assert body['effects'][0]['characterUuids'] == ['c1']
    assert body['effects'][0]['target'] == 'ONLY_ONE'


def test_flag_group_one_is_location_scoped():
    """INV-46: the group is who stands where the actor stands, not the whole match."""
    story = {**STORY, 'choiceEffects': [
        {'id': 20, 'idChoices': 20, 'idCard': 1, 'statistics': 'exp', 'value': 5,
         'flagGroup': 1}]}

    def side(pk, sk='METADATA'):
        if pk.startswith('STORY#'):
            return story
        return _get_side(pk, sk)

    body = _body(_resolve(
        'ch-plain', get_side=side,
        characters=[dict(CHARACTER), dict(COMPANION), dict(FAR_AWAY)]))

    assert body['effects'][0]['characterUuids'] == ['c1', 'c2']
    assert body['effects'][0]['target'] == 'ALL'


def test_the_whole_effect_vocabulary_lands_at_once():
    match = _match()
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side_with(match)), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item'):
        result = _call(_event('ch-world'))

    body = _body(result)
    # registry
    assert body['registryChanges'][0]['key'] == 'STEP32_GATE'
    assert body['registryChanges'][0]['newValue'] == 'OPEN'
    # item
    assert body['itemAdded'] is True
    assert body['itemChanges'][0]['itemUuid'] == 'item-1'
    # forced movement — no adjacency check, no energy cost
    assert body['movementApplied'] is True
    assert body['locationChanges'][0]['toLocationUuid'] == 'loc-3'
    assert match['movementLog'][-1]['energyCost'] == 0
    # weather
    assert body['weatherApplied'] is True
    assert match['currentWeatherId'] == 3
    # the effect's own idEvent ran inline: its card is what the board narrates with
    assert body['choiceEventUuid'] == 'evt-linked'
    assert body['choiceEventCard']['title'] == 'A Card'
    assert 'evt-linked' in body['executedEventUuids']


def test_value_to_remove_clears_the_key_only_on_a_match():
    story = {**STORY, 'choiceEffects': [
        {'id': 20, 'idChoices': 20, 'key': 'GATE', 'valueToRemove': 'OPEN'}]}

    def side(match_state):
        def inner(pk, sk='METADATA'):
            if pk.startswith('STORY#'):
                return story
            if pk.startswith('MATCH#'):
                return match_state
            return _get_side(pk, sk)
        return inner

    matching = {**_match(), 'registry': [{'key': 'GATE', 'stringValue': 'OPEN'}]}
    body = _body(_resolve('ch-plain', get_side=side(matching)))
    assert body['registryChanges'][0]['newValue'] is None

    # A key some other branch has since moved on is left alone.
    moved_on = {**_match(), 'registry': [{'key': 'GATE', 'stringValue': 'SEALED'}]}
    body = _body(_resolve('ch-plain', get_side=side(moved_on)))
    assert body['registryChanges'] == []


# ── the linked events ───────────────────────────────────────────────────────

def test_id_event_torun_runs_with_its_chain_and_is_not_charged():
    body = _body(_resolve('ch-world'))

    assert 'evt-outcome' in body['executedEventUuids']
    assert body['energySpent'] == 0  # a consequence costs nothing
    assert any(c['statistic'] == 'exp' and c['delta'] == 7 for c in body['statChanges'])


def test_a_linked_choice_event_presents_its_options_for_free():
    match = _match()
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side_with(match)), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item'):
        result = _call(_event('ch-nested'))

    body = _body(result)
    assert body['status'] == 'CHOICES_PENDING'
    assert [c['uuid'] for c in body['pendingChoices']] == ['ch-nested-inner']
    assert body['pendingChoices'][0]['available'] is True
    # Opened for free — a consequence is not a choice — but marked, so its cycle opens.
    assert body['energySpent'] == 0
    assert any(row['idEvent'] == 35 and row['message'] == 'EVENT_EXECUTED 35'
               for row in match['eventLog'])


def test_flag_end_time_on_a_linked_event_ends_the_time_unit():
    with _jwt(), \
         patch('match.handler.db_utils.get_item', side_effect=_get_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=[dict(CHARACTER)]), \
         patch('match.handler.db_utils.put_item'), \
         patch('match.handler._advance_time', return_value=(2, [], [])) as advance:
        result = _call(_event('ch-ender'))

    body = _body(result)
    assert body['timeEnded'] is True
    assert body['currentClock'] == 2
    advance.assert_called_once()


# ── the shared shape ────────────────────────────────────────────────────────

def test_the_payload_is_the_execute_event_one_plus_the_choice_block():
    body = _body(_resolve('ch-plain'))

    # The board runs one code path over both, so every execute-event field is here.
    for field in ('matchUuid', 'eventUuid', 'eventType', 'status', 'card',
                  'executedEventUuids', 'energySpent', 'coinSpent', 'newEnergy',
                  'newCoin', 'currentClock', 'turnConsumed', 'timeEnded', 'itemAdded',
                  'itemRemoved', 'weatherApplied', 'movementApplied', 'forcedSleep',
                  'comaTriggered', 'gameOver', 'refreshRecommended', 'statChanges',
                  'registryChanges', 'traitChanges', 'itemChanges',
                  'characteristicChanges', 'locationChanges', 'effects',
                  'pendingChoices', 'edgeState'):
        assert field in body, f'{field} missing from the resolution payload'
    for field in ('choiceUuid', 'narrative', 'choiceCard', 'choiceEventUuid',
                  'choiceEventCard', 'progressRecorded'):
        assert field in body, f'{field} missing from the resolution payload'
    assert body['turnConsumed'] is False  # turns are Step 61, for every action at once
    assert body['pendingChoices'] == []


# ── the chain walk and the coma guard ───────────────────────────────────────

def _story_with(extra_events=(), extra_effects=(), extra_choices=(),
                extra_choice_effects=()):
    return {**STORY,
            'events': [*STORY['events'], *extra_events],
            'eventEffects': [*STORY['eventEffects'], *extra_effects],
            'choices': [*STORY['choices'], *extra_choices],
            'choiceEffects': [*STORY['choiceEffects'], *extra_choice_effects]}


def _with_story(story):
    def side(pk, sk='METADATA'):
        if pk.startswith('STORY#'):
            return story
        return _get_side(pk, sk)
    return side


def test_the_linked_chain_walks_id_event_next():
    story = _story_with(
        extra_events=[
            {'id': 40, 'uuid': 'evt-first', 'type': 'NORMAL', 'idCard': 1,
             'costEnery': 0, 'flagEndTime': 0, 'idEventNext': 41},
            {'id': 41, 'uuid': 'evt-second', 'type': 'NORMAL', 'idCard': 1,
             'costEnery': 0, 'flagEndTime': 0, 'idEventNext': 40},  # authored loop
        ],
        extra_effects=[
            {'id': 40, 'idEvent': 40, 'statistics': 'exp', 'value': 1, 'target': 'ONLY_ONE'},
            {'id': 41, 'idEvent': 41, 'statistics': 'exp', 'value': 2, 'target': 'ONLY_ONE'},
        ],
        extra_choices=[{'id': 40, 'uuid': 'ch-chain', 'idEvent': 32, 'priority': 9,
                        'otherwiseFlag': 1, 'isProgress': 0, 'idEventTorun': 40}])

    body = _body(_resolve('ch-chain', get_side=_with_story(story)))

    # Both links ran, and the loop back to 40 stopped rather than spinning.
    assert body['executedEventUuids'] == ['evt-first', 'evt-second']
    assert sum(c['delta'] for c in body['statChanges'] if c['statistic'] == 'exp') == 3


def test_a_dangling_or_spent_link_is_authored_noise():
    story = _story_with(
        extra_choices=[{'id': 41, 'uuid': 'ch-dangling', 'idEvent': 32, 'priority': 9,
                        'otherwiseFlag': 1, 'isProgress': 0, 'idEventTorun': 404}])

    body = _body(_resolve('ch-dangling', get_side=_with_story(story)))

    assert body['status'] == 'APPLIED'
    assert body['choiceEventUuid'] is None
    assert body['executedEventUuids'] == []


def test_a_lethal_linked_event_stops_the_chain():
    story = _story_with(
        extra_events=[
            {'id': 42, 'uuid': 'evt-lethal', 'type': 'NORMAL', 'idCard': 1,
             'costEnery': 0, 'flagEndTime': 0, 'idEventNext': 43},
            {'id': 43, 'uuid': 'evt-after', 'type': 'NORMAL', 'idCard': 1,
             'costEnery': 0, 'flagEndTime': 0},
        ],
        extra_effects=[
            {'id': 42, 'idEvent': 42, 'statistics': 'life', 'value': -99,
             'target': 'ONLY_ONE'},
            {'id': 43, 'idEvent': 43, 'statistics': 'exp', 'value': 5,
             'target': 'ONLY_ONE'},
        ],
        extra_choices=[{'id': 42, 'uuid': 'ch-lethal', 'idEvent': 32, 'priority': 9,
                        'otherwiseFlag': 1, 'isProgress': 0, 'idEventTorun': 42}])

    body = _body(_resolve('ch-lethal', get_side=_with_story(story)))

    assert body['comaTriggered'] is True
    assert 'c1' in body['edgeState']['comaUuids']
    # The chain stops where the character does.
    assert 'evt-after' not in body['executedEventUuids']


def test_a_lethal_choice_row_stops_the_consequences_but_not_its_siblings():
    story = _story_with(
        extra_choices=[{'id': 43, 'uuid': 'ch-lethal-row', 'idEvent': 32, 'priority': 9,
                        'otherwiseFlag': 1, 'isProgress': 0, 'idEventTorun': 33}],
        extra_choice_effects=[
            {'id': 43, 'idChoices': 43, 'statistics': 'life', 'value': -99},
            {'id': 44, 'idChoices': 43, 'idItemTarget': 1, 'itemAction': 'ADD'},
        ])

    body = _body(_resolve('ch-lethal-row', get_side=_with_story(story)))

    assert body['comaTriggered'] is True
    # Same rule as an event: all rows land, then the Step 30 pass.
    assert body['itemAdded'] is True
    # …but the outcome event is not acted out by someone who can no longer act.
    assert 'evt-outcome' not in body['executedEventUuids']


# ── the linked event must not be barred by having run before ────────────────

def test_a_normal_linked_event_runs_even_if_the_match_already_executed_it():
    """The bug behind "the effect applies but the event never runs".

    Until v0.32.0 the guard tested EVERY linked event against consumedEventIds — the set
    of everything the match has ever executed — instead of applying that rule to ONCE
    only. So an option's "Event to Run" fired at most once per match and then quietly
    stopped: the stat still moved, the event silently did not.
    """
    already_run = _match(event_log=[
        {'characterUuid': 'c1', 'idEvent': 32, 'clock': 1, 'message': 'EVENT_EXECUTED 32'},
        # The linked NORMAL event ran earlier in this match — e.g. a previous resolution.
        {'characterUuid': 'c1', 'idEvent': 34, 'clock': 1, 'message': 'EVENT_EXECUTED 34'},
    ])

    body = _body(_resolve('ch-world', get_side=_get_side_with(already_run)))

    assert body['choiceEventUuid'] == 'evt-linked'
    assert 'evt-linked' in body['executedEventUuids']
    # Its effect really applied, not just its uuid reported.
    assert any(c['statistic'] == 'exp' and c['delta'] == 2 for c in body['statChanges'])


def test_a_spent_once_linked_event_is_still_barred():
    """The other half of the same rule: ONCE means once per match, whoever points at it."""
    story = _story_with(
        extra_events=[{'id': 50, 'uuid': 'evt-once-link', 'type': 'ONCE', 'idCard': 1,
                       'costEnery': 0, 'flagEndTime': 0}],
        extra_effects=[{'id': 50, 'idEvent': 50, 'statistics': 'exp', 'value': 4,
                        'target': 'ONLY_ONE'}],
        extra_choices=[{'id': 50, 'uuid': 'ch-once-link', 'idEvent': 32, 'priority': 9,
                        'otherwiseFlag': 1, 'isProgress': 0, 'idEventTorun': 50}])
    spent = _match(event_log=[
        {'characterUuid': 'c1', 'idEvent': 32, 'clock': 1, 'message': 'EVENT_EXECUTED 32'},
        {'characterUuid': 'c1', 'idEvent': 50, 'clock': 1, 'message': 'EVENT_EXECUTED 50'},
    ])

    def side(pk, sk='METADATA'):
        if pk.startswith('STORY#'):
            return story
        if pk.startswith('MATCH#'):
            return spent
        return _get_side(pk, sk)

    body = _body(_resolve('ch-once-link', get_side=side))

    assert 'evt-once-link' not in body['executedEventUuids']
    assert body['statChanges'] == []


def test_a_link_is_not_run_twice_within_one_resolution():
    """Two effect rows pointing at the same event still run it once."""
    story = _story_with(
        extra_choices=[{'id': 51, 'uuid': 'ch-double-link', 'idEvent': 32, 'priority': 9,
                        'otherwiseFlag': 1, 'isProgress': 0}],
        extra_choice_effects=[
            {'id': 51, 'idChoices': 51, 'idEvent': 34},
            {'id': 52, 'idChoices': 51, 'idEvent': 34},
        ])

    body = _body(_resolve('ch-double-link', get_side=_with_story(story)))

    assert body['executedEventUuids'].count('evt-linked') == 1
    # exp +2 once, not twice.
    assert sum(c['delta'] for c in body['statChanges'] if c['statistic'] == 'exp') == 2
