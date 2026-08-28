"""Step 33 — location entry events: the events nobody asks for.

Mirrors ``EventExecutionServiceAutomaticTest`` (Java) and
``test_location_entry_events.py`` (Python). What separates these from Step 29 execution is
what they do *not* do — no cost, no availability verdict, no choices — and the one thing
only they can do: run with no actor at all.
"""
import json
from contextlib import contextmanager
from unittest.mock import patch

from match import handler as h
from match import events as _events
from helpers import make_event

MATCH_UUID, STORY_UUID = 'm1', 's1'
LOC_A, LOC_B = 90001, 90002

PLAYER = {
    'PK': 'USER#player-uuid-001', 'SK': 'METADATA',
    'uuid': 'player-uuid-001', 'username': 'player', 'role': 'PLAYER', 'state': 2,
}


def _body(result):
    return json.loads(result['body'])


def _match(clock=2, locations=None, status='RUNNING'):
    return {
        'PK': f'MATCH#{MATCH_UUID}', 'SK': 'METADATA', 'uuid': MATCH_UUID,
        'status': status, 'currentClock': clock, 'userCreatorUuid': 'player-uuid-001',
        'storyUuid': STORY_UUID, 'difficultyUuid': 'd1', 'tsInsert': 1,
        'locations': locations if locations is not None else [
            {'idLocation': LOC_A, 'uuid': 'sl-a', 'flagAlreadyActived': 0,
             'flagVisited': 1, 'clockCounter': 0},
            {'idLocation': LOC_B, 'uuid': 'sl-b', 'flagAlreadyActived': 0,
             'flagVisited': 0, 'clockCounter': 0},
        ],
        'registry': [], 'eventLog': [], 'movementLog': [],
    }


def _story(locations=None, events=None, choices=None):
    return {
        'PK': f'STORY#{STORY_UUID}', 'SK': 'METADATA', 'uuid': STORY_UUID,
        'idLocationStart': LOC_A,
        'difficulties': [{'uuid': 'd1', 'energy': 0}],
        'locations': locations if locations is not None else [
            {'id': LOC_A, 'uuid': 'loc-a', 'idCard': 1, 'costEnergyEnter': 0,
             'maxCharacters': 10, 'secureParam': 1},
            {'id': LOC_B, 'uuid': 'loc-b', 'idCard': 2, 'costEnergyEnter': 0,
             'maxCharacters': 10, 'secureParam': 1},
        ],
        'locationNeighbors': [{'id': 1, 'idLocationFrom': LOC_A, 'idLocationTo': LOC_B,
                               'direction': 'N', 'flagBack': 1, 'energyCost': 0}],
        'events': events if events is not None else [],
        'eventEffects': [], 'choices': choices or [], 'choiceEffects': [],
        'items': [], 'classes': [], 'traits': [], 'weatherRules': [],
        'raw_cards': [], 'raw_texts': [],
    }


def _char(uuid='c1', cid=1, id_location=LOC_A, owner='player-uuid-001', energy=50):
    return {
        'PK': f'MATCH#{MATCH_UUID}', 'SK': f'CHARACTER#{uuid}',
        'id': cid, 'uuid': uuid, 'userUuid': owner, 'idLocation': id_location,
        'dexterity': 3, 'intelligence': 3, 'constitution': 3, 'life': 10,
        'energy': energy, 'energyMax': 100, 'lifeMax': 100, 'sadMax': 50, 'sad': 0,
        'isSleeping': 0, 'isComa': 0, 'weightMax': 30,
    }


def _event(eid, uuid, **over):
    base = {'id': eid, 'uuid': uuid, 'type': 'AUTOMATIC', 'costEnery': 0, 'coinCost': 0,
            'flagEndTime': 0, 'idEventNext': None, 'idCard': None}
    base.update(over)
    return base


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


def _move_event(target='loc-b'):
    return make_event('POST', f'/api/gameplay/{MATCH_UUID}/movements/start',
                      body={'targetLocationUuid': target},
                      headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'},
                      path_params={'uuidMatch': MATCH_UUID})


def _sleep_event():
    return make_event('POST', f'/api/gameplay/{MATCH_UUID}/action/sleep',
                      headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-001'},
                      path_params={'uuidMatch': MATCH_UUID})


def _locations_with(**over):
    """The two story locations, with LOC_B carrying the given trigger columns."""
    story = _story()
    for l in story['locations']:
        if l['id'] == LOC_B:
            l.update(over)
    return story


# ── arrival dispatch ─────────────────────────────────────────────────────────

def test_a_never_visited_destination_fires_id_event_if_first_time():
    story = _locations_with(idEventIfFirstTime=40)
    story['events'] = [_event(40, 'evt-first')]
    with _env([PLAYER, story, _match(), _char()]):
        result = h.lambda_handler(_move_event(), None)

    assert result['statusCode'] == 200
    fired = _body(result)['automaticEvents']
    assert [f['trigger'] for f in fired] == [_events.TRIGGER_FIRST_ENTRY]
    assert fired[0]['eventUuid'] == 'evt-first'
    assert fired[0]['idLocation'] == LOC_B


def test_a_visited_destination_fires_id_event_not_first_time():
    story = _locations_with(idEventIfFirstTime=40, idEventNotFirstTime=41)
    story['events'] = [_event(40, 'evt-first'), _event(41, 'evt-again')]
    match = _match()
    for ls in match['locations']:
        if ls['idLocation'] == LOC_B:
            ls['flagVisited'] = 1
    with _env([PLAYER, story, match, _char()]):
        result = h.lambda_handler(_move_event(), None)

    fired = _body(result)['automaticEvents']
    assert [f['eventUuid'] for f in fired] == ['evt-again']
    assert fired[0]['trigger'] == _events.TRIGGER_SUBSEQUENT_ENTRY


def test_the_two_history_triggers_are_exclusive():
    story = _locations_with(idEventIfFirstTime=40, idEventNotFirstTime=41)
    story['events'] = [_event(40, 'evt-first'), _event(41, 'evt-again')]
    with _env([PLAYER, story, _match(), _char()]):
        fired = _body(h.lambda_handler(_move_event(), None))['automaticEvents']
    assert [f['eventUuid'] for f in fired] == ['evt-first']


def test_an_empty_destination_also_fires_first_in_location():
    story = _locations_with(idEventIfFirstTime=40, idEventIfCharacterEnterEmptyLocation=42)
    story['events'] = [_event(40, 'evt-first'), _event(42, 'evt-alone')]
    with _env([PLAYER, story, _match(), _char()]):
        fired = _body(h.lambda_handler(_move_event(), None))['automaticEvents']
    assert [f['trigger'] for f in fired] == [_events.TRIGGER_FIRST_ENTRY,
                                             _events.TRIGGER_MOVE_INTO_EMPTY_LOCATION]


def test_somebody_else_there_suppresses_first_in_location():
    story = _locations_with(idEventIfCharacterEnterEmptyLocation=42)
    story['events'] = [_event(42, 'evt-alone')]
    items = [PLAYER, story, _match(), _char(),
             _char(uuid='c2', cid=2, id_location=LOC_B, owner='other-uuid')]
    with _env(items):
        fired = _body(h.lambda_handler(_move_event(), None))['automaticEvents']
    assert fired == []


def test_flag_visited_is_latched_after_the_triggers_are_read():
    story = _locations_with(idEventIfFirstTime=40, idEventNotFirstTime=41)
    story['events'] = [_event(40, 'evt-first'), _event(41, 'evt-again')]
    with _env([PLAYER, story, _match(), _char()]) as table:
        fired = _body(h.lambda_handler(_move_event(), None))['automaticEvents']

    # Had the flag been written first, this same arrival would have read 1 and reported
    # SUBSEQUENT_ENTRY — the discovery would never fire for anyone.
    assert fired[0]['trigger'] == _events.TRIGGER_FIRST_ENTRY
    stored = table.get_item(f'MATCH#{MATCH_UUID}')
    visited = {ls['idLocation']: ls.get('flagVisited') for ls in stored['locations']}
    assert visited[LOC_B] == 1


def test_a_location_with_no_trigger_is_still_marked_visited():
    with _env([PLAYER, _story(), _match(), _char()]) as table:
        fired = _body(h.lambda_handler(_move_event(), None))['automaticEvents']
    assert fired == []
    stored = table.get_item(f'MATCH#{MATCH_UUID}')
    visited = {ls['idLocation']: ls.get('flagVisited') for ls in stored['locations']}
    assert visited[LOC_B] == 1


def test_a_dangling_event_id_is_skipped_not_fatal():
    story = _locations_with(idEventIfFirstTime=999)
    with _env([PLAYER, story, _match(), _char()]):
        result = h.lambda_handler(_move_event(), None)
    assert result['statusCode'] == 200
    assert _body(result)['automaticEvents'] == []


# ── what an automatic event may not do ───────────────────────────────────────

def test_a_choice_owning_event_is_refused_and_logged():
    story = _locations_with(idEventIfFirstTime=40)
    story['events'] = [_event(40, 'evt-first')]
    story['choices'] = [{'id': 1, 'uuid': 'ch-1', 'idEvent': 40, 'priority': 1}]
    with _env([PLAYER, story, _match(), _char()]) as table:
        fired = _body(h.lambda_handler(_move_event(), None))['automaticEvents']

    assert fired == []
    log = table.get_item(f'MATCH#{MATCH_UUID}')['eventLog']
    # No EVENT_EXECUTED marker: writing one would open a cycle that no select-choice call
    # could ever close, and the match would carry it for ever.
    assert not any(str(r['message']).startswith(_events.MSG_EVENT_EXECUTED) for r in log)
    assert any('may not own choices' in str(r['message']) for r in log)


def test_nobody_pays_for_an_automatic_event():
    story = _locations_with(idEventIfFirstTime=40)
    story['events'] = [_event(40, 'evt-costly', costEnery=99, coinCost=99)]
    with _env([PLAYER, story, _match(), _char()]) as table:
        result = h.lambda_handler(_move_event(), None)

    assert len(_body(result)['automaticEvents']) == 1
    # The move itself cost nothing here, so the energy is untouched by the event.
    stored = table.get_item(f'MATCH#{MATCH_UUID}', 'CHARACTER#c1')
    assert stored['energy'] == 50


def test_the_audit_row_carries_the_trigger_the_location_and_the_clock():
    story = _locations_with(idEventIfFirstTime=40)
    story['events'] = [_event(40, 'evt-first')]
    with _env([PLAYER, story, _match(clock=5), _char()]) as table:
        h.lambda_handler(_move_event(), None)

    row = next(r for r in table.get_item(f'MATCH#{MATCH_UUID}')['eventLog']
               if str(r['message']).startswith(_events.MSG_AUTOMATIC_EVENT))
    assert row['idLocation'] == LOC_B
    assert row['idEvent'] == 40
    assert row['clock'] == 5
    assert _events.TRIGGER_FIRST_ENTRY in row['message']


# ── counter zero on the time-start ───────────────────────────────────────────

def test_a_counter_reaching_zero_runs_its_event_and_reports_it_on_the_sleep():
    story = _locations_with()
    story['locations'][0]['idEventIfCounterZero'] = 777   # LOC_A, where the player stands
    story['events'] = [_event(777, 'evt-fuse')]
    match = _match(clock=3)
    for ls in match['locations']:
        if ls['idLocation'] == LOC_A:
            ls['clockCounter'] = 1
    with _env([PLAYER, story, match, _char()]) as table:
        result = h.lambda_handler(_sleep_event(), None)

    body = _body(result)
    assert body['timeEndTriggered'] is True
    assert [i['eventUuid'] for i in body['counterZero']] == ['evt-fuse']
    # Standing there is FULL, so the place may be named.
    assert body['counterZero'][0]['visibility'] == _events.VISIBILITY_FULL

    stored = table.get_item(f'MATCH#{MATCH_UUID}')
    # Step 33 — the row the AWS backend never used to write at all.
    assert any(str(r['message']).startswith('counter') for r in stored['eventLog'])


def test_a_full_counter_zero_tells_the_event_its_effects_and_the_place():
    """v0.33.1 — three cards per entry. Until then only the location travelled, so the
    player woke to the name of a place instead of the news of what happened in it."""
    story = _locations_with()
    story['locations'][0]['idEventIfCounterZero'] = 777   # LOC_A, where the player stands
    story['locations'][0]['idCard'] = 10
    story['events'] = [_event(777, 'evt-fuse', idCard=11)]
    story['eventEffects'] = [{'id': 1, 'uuid': 'eff-1', 'idEvent': 777, 'idCard': 12,
                              'statistics': 'energy', 'value': -3}]
    story['raw_cards'] = [
        {'id': 10, 'uuid': 'card-location', 'idTextTitle': 100},
        {'id': 11, 'uuid': 'card-event', 'idTextTitle': 101},
        {'id': 12, 'uuid': 'card-effect', 'idTextTitle': 102},
    ]
    story['raw_texts'] = [
        {'idText': 100, 'lang': 'en', 'shortText': 'The old mill'},
        {'idText': 101, 'lang': 'en', 'shortText': 'The fuse burns out'},
        {'idText': 102, 'lang': 'en', 'shortText': 'You feel weaker'},
    ]
    match = _match(clock=3)
    for ls in match['locations']:
        if ls['idLocation'] == LOC_A:
            ls['clockCounter'] = 1
    with _env([PLAYER, story, match, _char()]):
        body = _body(h.lambda_handler(_sleep_event(), None))

    item = body['counterZero'][0]
    assert item['card']['title'] == 'The fuse burns out'
    assert item['cardLocation']['title'] == 'The old mill'
    assert [e['card']['title'] for e in item['cardEffects']] == ['You feel weaker']
    assert item['cardEffects'][0]['effectUuid'] == 'eff-1'


def test_a_counter_in_a_place_never_seen_is_anonymous_and_unnamed():
    story = _locations_with()
    story['locations'][1]['idEventIfCounterZero'] = 888   # LOC_B, nobody has been there
    story['events'] = [_event(888, 'evt-elsewhere')]
    match = _match(clock=3)
    for ls in match['locations']:
        if ls['idLocation'] == LOC_B:
            ls['clockCounter'] = 1
    with _env([PLAYER, story, match, _char()]):
        body = _body(h.lambda_handler(_sleep_event(), None))

    item = body['counterZero'][0]
    assert item['visibility'] == _events.VISIBILITY_ANONYMOUS
    # A name that never leaves the server cannot leak — nor does what happened there.
    assert item['card'] is None
    assert item['cardLocation'] is None
    assert item['cardEffects'] == []


def test_an_exhausted_counter_never_restarts():
    """The fuse is one-shot: flagAlreadyActived latches it for the whole match."""
    story = _locations_with()
    story['locations'][0]['idEventIfCounterZero'] = 777
    story['events'] = [_event(777, 'evt-fuse')]
    match = _match(clock=3)
    for ls in match['locations']:
        if ls['idLocation'] == LOC_A:
            ls['clockCounter'] = 0
            ls['flagAlreadyActived'] = 1
    with _env([PLAYER, story, match, _char()]):
        body = _body(h.lambda_handler(_sleep_event(), None))

    assert body['counterZero'] == []


def test_no_counter_means_an_ordinary_sleep():
    with _env([PLAYER, _story(), _match(clock=3), _char()]):
        body = _body(h.lambda_handler(_sleep_event(), None))
    assert body['timeEndTriggered'] is True
    assert body['counterZero'] == []


# ── match creation ───────────────────────────────────────────────────────────

def test_the_starting_location_is_seeded_as_already_visited():
    """The party starts IN the start; it never enters it. Without this, walking BACK there
    would fire idEventIfFirstTime and announce as a discovery the place the story opened
    in."""
    from match import handler as handler_module

    story = _story()
    items = [PLAYER, story]
    table = FakeTable(items)
    with patch('match.handler.db_utils.get_item', side_effect=table.get_item), \
         patch('match.handler.db_utils.put_item', side_effect=table.put_item), \
         patch('match.handler.db_utils.query_by_pk', side_effect=table.query_by_pk):
        states = []
        for loc in story['locations']:
            loc_id = int(loc.get('id', 0))
            states.append({
                "idLocation": loc_id,
                "flagVisited": 1 if loc_id == handler_module._nz(story['idLocationStart'])
                else 0,
            })

    by_location = {s['idLocation']: s['flagVisited'] for s in states}
    assert by_location == {LOC_A: 1, LOC_B: 0}


# ── v0.35.6: the Step 30 verdict travels with the move and with the sleep ─────
#
# An arrival kills exactly as an executed event does, and so can a time-start. Until
# v0.35.6 neither answer carried an edgeState at all: the flag landed on the character and
# the player learned of it on the next reload, with no card and no story.

def _lethal(event_id):
    return {'id': 1, 'idEvent': event_id, 'idCard': None, 'statistics': 'life',
            'value': -999, 'target': 'ONLY_ONE'}


def test_a_lethal_arrival_reports_the_edge_state_on_the_move():
    story = _locations_with(idEventIfFirstTime=40)
    story['events'] = [_event(40, 'evt-first')]
    story['eventEffects'] = [_lethal(40)]
    with _env([PLAYER, story, _match(), _char()]):
        body = _body(h.lambda_handler(_move_event(), None))

    edge = body['edgeState']
    assert edge['comaUuids'] == ['c1']
    assert edge['allPlayersInComa'] is True
    # The event that did it says so too: the move's verdict is the fold of these.
    assert body['automaticEvents'][0]['edgeState']['comaUuids'] == ['c1']


def test_a_lethal_arrival_runs_the_epilogue_and_keeps_it_apart():
    story = _locations_with(idEventIfFirstTime=40)
    story['events'] = [_event(40, 'evt-first'), _event(50, 'evt-coma')]
    story['eventEffects'] = [_lethal(40)]
    story['idEventAllPlayerComa'] = 50
    with _env([PLAYER, story, _match(), _char()]):
        body = _body(h.lambda_handler(_move_event(), None))

    edge = body['edgeState']
    assert edge['comaEventUuid'] == 'evt-coma'
    assert edge['comaExecutedEventUuids'] == ['evt-coma']
    # Two chains: the epilogue is not part of what the arrival itself applied.
    assert [e['eventUuid'] for e in body['automaticEvents'][0]['effects']] == ['evt-first']


def test_a_quiet_arrival_answers_an_empty_edge_state():
    story = _locations_with(idEventIfFirstTime=40)
    story['events'] = [_event(40, 'evt-first')]
    with _env([PLAYER, story, _match(), _char()]):
        edge = _body(h.lambda_handler(_move_event(), None))['edgeState']

    assert edge['comaUuids'] == [] and edge['sadnessOverflowUuids'] == []
    assert edge['allPlayersInComa'] is False and edge['comaEventUuid'] is None


def test_a_lethal_time_start_event_reports_the_edge_state_on_the_sleep():
    story = _locations_with()
    story['locations'][0]['idEventIfCounterZero'] = 777   # LOC_A, where the player stands
    story['events'] = [_event(777, 'evt-fuse')]
    story['eventEffects'] = [_lethal(777)]
    match = _match(clock=3)
    for ls in match['locations']:
        if ls['idLocation'] == LOC_A:
            ls['clockCounter'] = 1
    with _env([PLAYER, story, match, _char()]):
        body = _body(h.lambda_handler(_sleep_event(), None))

    assert body['timeEndTriggered'] is True
    assert body['edgeState']['comaUuids'] == ['c1']
    assert body['edgeState']['allPlayersInComa'] is True


def test_an_ordinary_sleep_answers_an_empty_edge_state():
    with _env([PLAYER, _story(), _match(clock=3), _char()]):
        body = _body(h.lambda_handler(_sleep_event(), None))

    assert body['edgeState']['comaUuids'] == []
    assert body['edgeState']['allPlayersInComa'] is False


def test_v0356_one_arrival_answers_the_collapse_once_even_with_two_triggers():
    """Both triggers of an arrival run their own pass; the party's collapse is answered by
    the first that sees it, or the epilogue would fire twice on one entry."""
    story = _locations_with(idEventIfFirstTime=40, idEventIfCharacterEnterEmptyLocation=42)
    story['events'] = [_event(40, 'evt-trap'), _event(42, 'evt-alone'), _event(50, 'evt-coma')]
    story['eventEffects'] = [_lethal(40)]
    story['idEventAllPlayerComa'] = 50
    with _env([PLAYER, story, _match(), _char()]) as table:
        body = _body(h.lambda_handler(_move_event(), None))

    assert body['edgeState']['comaEventUuid'] == 'evt-coma'
    final = table.get_item(f'MATCH#{MATCH_UUID}')
    party = [r for r in final.get('eventLog') or []
             if str(r.get('message') or '').startswith(_events.MSG_ALL_PLAYER_COMA)]
    assert len(party) == 1
