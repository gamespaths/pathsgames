"""Coverage for the Step 28.7 match logs routes in match/handler.py.

GET /api/matches/{uuid}/logs        — owner-only consolidated timeline
GET /api/admin/matches/{uuid}/logs  — same payload, no ownership check

v0.37.5 — the timeline is read from the LOG# rows of the match partition (one item per
entry, already normalised) and `total` is the counter the match item keeps. The tests
drive the handler against the shared FakeTable; no AWS calls are made.
"""
import json
from unittest.mock import patch

from helpers import make_event, FakeTable, patch_table
from match import logbook

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'guest', 'role': 'PLAYER'}
ADMIN_USER = {'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001',
              'username': 'admin', 'role': 'ADMIN'}


def _match(**over):
    item = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
            'currentClock': 2, 'userCreatorUuid': 'u1'}
    item.update(over)
    return item


def _row(seq, entry_type, ts, **fields):
    """One stored LOG# row, the shape logbook.persist writes."""
    row = {'PK': 'MATCH#m1', 'SK': f'LOG#{ts:013d}#{seq:06d}', 'type': entry_type,
           'clock': fields.pop('clock', None), 'timestamp': logbook.ms_to_iso(ts),
           'timestampMs': ts}
    row.update(fields)
    return row


BASE_ROWS = [
    _row(1, 'WEATHER', 1000, clock=1, idWeather=3, weatherUuid='w-3'),
    _row(2, 'MOVEMENT', 2000, characterUuid='c1', idLocationFrom=1, idLocationTo=2,
         energyCost=4),
    _row(3, 'SLEEP', 3000, clock=1, characterUuid='c1'),
    _row(4, 'CLOCK_ADVANCE', 4000, clock=2),
]


def _table(items=None, rows=BASE_ROWS, match=None):
    match = match if match is not None else _match(logCount=len(rows), logSeq=len(rows))
    return FakeTable([USER, ADMIN_USER, match] + list(rows) + list(items or []))


def _body(result):
    return json.loads(result['body'])


def _call(event, table, role='PLAYER', uuid='u1'):
    from match.handler import lambda_handler
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': uuid, 'source': 'mock', 'role': role}), \
         patch('match.handler._check_admin_ip', return_value=None), \
         patch_table(table):
        return lambda_handler(event, {})


def _player_event(uuid='m1', qs=None):
    return make_event('GET', f'/api/matches/{uuid}/logs',
                      headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                      path_params={'uuidMatch': uuid}, qs=qs)


def _admin_event(uuid='m1', qs=None):
    return make_event('GET', f'/api/admin/matches/{uuid}/logs',
                      headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                      path_params={'uuidMatch': uuid}, qs=qs)


def _admin(event, table):
    return _call(event, table, role='ADMIN', uuid='admin-uuid-001')


# ── _ms_to_iso ──────────────────────────────────────────────────────────────

def test_ms_to_iso_converts_and_handles_none_and_garbage():
    from match.handler import _ms_to_iso
    assert _ms_to_iso(None) is None
    assert _ms_to_iso(1000).startswith('1970-01-01T00:00:01')
    assert _ms_to_iso('not-a-number') == 'not-a-number'


# ── player endpoint ─────────────────────────────────────────────────────────

def test_get_match_logs_returns_full_timeline():
    result = _call(_player_event(), _table())
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['matchUuid'] == 'm1'
    assert body['currentClock'] == 2
    # Sort-key order = timestamp order, whatever the entry type.
    assert [e['type'] for e in body['logs']] == [
        'WEATHER', 'MOVEMENT', 'SLEEP', 'CLOCK_ADVANCE',
    ]
    weather, movement = body['logs'][0], body['logs'][1]
    assert weather['idWeather'] == 3
    assert movement['idLocationTo'] == 2 and movement['energyCost'] == 4
    assert body['total'] == 4 and body['nextCursor'] is None
    # Row bookkeeping never reaches the API.
    for entry in body['logs']:
        assert not {'PK', 'SK', 'timestampMs', 'weatherUuid', 'ts_insert'} & set(entry)


def test_get_match_logs_empty_match_returns_empty_list():
    table = _table(rows=[], match=_match(currentClock=0))
    result = _call(_player_event(), table)
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['logs'] == [] and body['total'] == 0 and body['nextCursor'] is None


def test_a_legacy_match_with_inline_lists_answers_an_empty_timeline():
    """A match written before v0.37.5: its lists are ignored, never a crash."""
    legacy = _match(weatherLog=[{'clock': 1}], eventLog=[{'message': 'EVENT_EXECUTED 1'}])
    body = _body(_call(_player_event(), _table(rows=[], match=legacy)))
    assert body['logs'] == [] and body['total'] == 0


def test_get_match_logs_unknown_match_returns_404():
    result = _call(_player_event('nope'), _table())
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


def test_get_match_logs_of_another_user_returns_404():
    table = _table(match=_match(userCreatorUuid='someone-else'))
    result = _call(_player_event(), table)
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


def test_audit_rows_never_reach_the_timeline():
    """Step 30 edge-state rows are AUDIT# items: neither listed nor counted."""
    rows = [_row(1, 'EVENT', 5000, clock=3, characterUuid='c1', idEvent=90010,
                 message='EVENT_EXECUTED 90010')]
    audits = [{'PK': 'MATCH#m1', 'SK': 'AUDIT#0000000005100#000002', 'kind': 'EDGE_STATE',
               'message': 'SADNESS_OVERFLOW c1'},
              {'PK': 'MATCH#m1', 'SK': 'AUDIT#0000000005200#000003', 'kind': 'EDGE_STATE',
               'message': 'COMA c1'}]
    table = _table(items=audits, rows=rows, match=_match(logCount=1, logSeq=3))
    body = _body(_call(_player_event(), table))
    assert [e['type'] for e in body['logs']] == ['EVENT']
    assert body['logs'][0]['idEvent'] == 90010
    assert body['total'] == 1


def test_get_match_logs_without_token_returns_401():
    from match.handler import lambda_handler
    event = make_event('GET', '/api/matches/m1/logs', path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401


# ── admin endpoint ──────────────────────────────────────────────────────────

def test_admin_logs_skips_the_ownership_check():
    table = _table(match=_match(userCreatorUuid='someone-else', logCount=4))
    result = _admin(_admin_event(), table)
    assert result['statusCode'] == 200
    assert len(_body(result)['logs']) == 4


def test_admin_logs_blank_uuid_returns_400():
    from match.handler import _get_admin_match_logs
    result = _get_admin_match_logs('  ')
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


def test_admin_logs_unknown_match_returns_404():
    result = _admin(_admin_event('nope'), _table())
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


# ── v0.28.7: cursor pagination ──────────────────────────────────────────────

def _clock_rows(count):
    return [_row(i + 1, 'CLOCK_ADVANCE', 1000 * (i + 1), clock=i) for i in range(count)]


def _clock_table(count):
    return _table(rows=_clock_rows(count), match=_match(logCount=count, logSeq=count))


def test_clamp_limit_bounds():
    from match.handler import (LOGS_DEFAULT_LIMIT, LOGS_MAX_LIMIT, _clamp_logs_limit)
    assert _clamp_logs_limit(None) == LOGS_DEFAULT_LIMIT
    assert _clamp_logs_limit('') == LOGS_DEFAULT_LIMIT
    assert _clamp_logs_limit('not-a-number') == LOGS_DEFAULT_LIMIT
    assert _clamp_logs_limit(9999) == LOGS_MAX_LIMIT
    assert _clamp_logs_limit(0) == 1
    assert _clamp_logs_limit('10') == 10


def test_first_page_is_capped_and_exposes_next_cursor():
    body = _body(_call(_player_event(qs={'limit': '2'}), _clock_table(5)))

    assert len(body['logs']) == 2
    assert body['limit'] == 2
    assert body['total'] == 5
    assert body['nextCursor'] is not None
    assert [e['clock'] for e in body['logs']] == [0, 1]


def test_next_cursor_walks_to_the_end_then_goes_none():
    table = _clock_table(5)

    def page(cursor=None):
        qs = {'limit': '2'}
        if cursor:
            qs['cursor'] = cursor
        return _body(_call(_player_event(qs=qs), table))

    p1 = page()
    p2 = page(p1['nextCursor'])
    p3 = page(p2['nextCursor'])

    assert [e['clock'] for e in p2['logs']] == [2, 3]
    assert [e['clock'] for e in p3['logs']] == [4]
    assert p3['nextCursor'] is None


def test_a_page_that_ends_exactly_on_the_last_row_has_no_cursor():
    body = _body(_call(_player_event(qs={'limit': '2'}), _clock_table(2)))
    assert [e['clock'] for e in body['logs']] == [0, 1]
    assert body['nextCursor'] is None and body['total'] == 2


def test_a_garbage_or_foreign_cursor_restarts_from_the_first_page():
    from common import db_utils
    table = _clock_table(2)
    foreign = db_utils.encode_cursor({'PK': 'MATCH#other', 'SK': 'LOG#0000000000001#000001'})
    for cursor in ('###', foreign, db_utils.encode_cursor({'PK': 'MATCH#m1', 'SK': 'TURN#x'})):
        body = _body(_call(_player_event(qs={'limit': '2', 'cursor': cursor}), table))
        assert [e['clock'] for e in body['logs']] == [0, 1], cursor
        assert body['nextCursor'] is None
        assert body['total'] == 2


# ── order=asc|desc ──────────────────────────────────────────────────────────

def test_normalize_order_accepts_only_desc():
    from match.handler import _normalize_logs_order
    assert _normalize_logs_order('desc') == 'desc'
    assert _normalize_logs_order(' DESC ') == 'desc'
    assert _normalize_logs_order('asc') == 'asc'
    assert _normalize_logs_order(None) == 'asc'
    assert _normalize_logs_order('sideways') == 'asc'


def test_desc_starts_from_the_newest_entry():
    body = _body(_call(_player_event(qs={'order': 'desc', 'limit': '2'}), _clock_table(5)))
    assert body['order'] == 'desc'
    assert [e['clock'] for e in body['logs']] == [4, 3]
    assert body['total'] == 5


def test_desc_cursor_walks_towards_the_older_entries():
    table = _clock_table(5)

    def page(cursor=None):
        qs = {'order': 'desc', 'limit': '2'}
        if cursor:
            qs['cursor'] = cursor
        return _body(_call(_player_event(qs=qs), table))

    p1 = page()
    p2 = page(p1['nextCursor'])
    p3 = page(p2['nextCursor'])
    assert [e['clock'] for e in p2['logs']] == [2, 1]
    assert [e['clock'] for e in p3['logs']] == [0]
    assert p3['nextCursor'] is None


def test_desc_reverses_entries_of_every_type():
    body = _body(_call(_player_event(qs={'order': 'desc'}), _table()))
    assert [e['type'] for e in body['logs']] == [
        'CLOCK_ADVANCE', 'SLEEP', 'MOVEMENT', 'WEATHER',
    ]


def test_unknown_order_falls_back_to_ascending():
    body = _body(_call(_player_event(qs={'order': 'sideways'}), _clock_table(3)))
    assert body['order'] == 'asc'
    assert [e['clock'] for e in body['logs']] == [0, 1, 2]


def test_admin_endpoint_honours_the_order_too():
    body = _body(_admin(_admin_event(qs={'order': 'desc'}), _clock_table(3)))
    assert [e['clock'] for e in body['logs']] == [2, 1, 0]


# ── v0.28.7: card + character enrichment ────────────────────────────────────

STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
    'weatherRules': [{'id': 3, 'uuid': 'w-3', 'idCard': 300}],
    'locations': [{'id': 2, 'uuid': 'loc-2', 'idCard': 400}],
    'characterTemplates': [{'uuid': 'tpl-9', 'idCard': 500}],
    'events': [{'id': 90010, 'idCard': 600}],
    'missions': [{'id': 1, 'uuid': 'm-1', 'idCard': 700}],
    'missionSteps': [{'id': 10, 'idMission': 1, 'step': 7, 'idCard': 701}],
    'items': [{'id': 900, 'idCard': 800}],
    'raw_cards': [
        {'id': 300, 'uuid': 'card-300', 'idTextTitle': 1},
        {'id': 400, 'uuid': 'card-400', 'idTextTitle': 2},
        {'id': 500, 'uuid': 'card-500', 'idTextTitle': 3},
        {'id': 600, 'uuid': 'card-600', 'idTextTitle': 4},
        {'id': 700, 'uuid': 'card-700', 'idTextTitle': 5},
        {'id': 701, 'uuid': 'card-701', 'idTextTitle': 6},
        {'id': 800, 'uuid': 'card-800', 'idTextTitle': 7},
    ],
    'raw_texts': [
        {'idText': 1, 'lang': 'en', 'shortText': 'Thunderstorm'},
        {'idText': 2, 'lang': 'en', 'shortText': 'Dark Forest'},
        {'idText': 3, 'lang': 'en', 'shortText': 'Ranger'},
        {'idText': 4, 'lang': 'en', 'shortText': 'A Fork In The Road'},
        {'idText': 5, 'lang': 'en', 'shortText': 'The Journey'},
        {'idText': 6, 'lang': 'en', 'shortText': 'Reach the hills'},
        {'idText': 7, 'lang': 'en', 'shortText': 'Old Lantern'},
    ],
}

CHARACTER = {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1',
             'characterTemplateUuid': 'tpl-9'}


def _enrich_table(rows=BASE_ROWS):
    return _table(items=[STORY, CHARACTER], rows=rows,
                  match=_match(storyUuid='s1', logCount=len(rows), logSeq=len(rows)))


def test_weather_and_movement_entries_carry_their_cards():
    body = _body(_call(_player_event(), _enrich_table()))

    weather = next(e for e in body['logs'] if e['type'] == 'WEATHER')
    assert weather['idCard'] == 300
    assert weather['card']['title'] == 'Thunderstorm'

    movement = next(e for e in body['logs'] if e['type'] == 'MOVEMENT')
    assert movement['idCard'] == 400
    assert movement['card']['title'] == 'Dark Forest'


def test_movement_entry_names_the_character_that_moved():
    body = _body(_call(_player_event(), _enrich_table()))
    movement = next(e for e in body['logs'] if e['type'] == 'MOVEMENT')
    assert movement['characterUuid'] == 'c1'
    assert movement['characterName'] == 'Ranger'


def test_event_entry_carries_its_own_card_and_character():
    rows = [_row(1, 'EVENT', 5000, clock=3, characterUuid='c1', idEvent=90010,
                 message='EVENT_EXECUTED 90010')]
    body = _body(_call(_player_event(), _enrich_table(rows)))
    event = next(e for e in body['logs'] if e['type'] == 'EVENT')
    assert event['idEvent'] == 90010
    assert event['idCard'] == 600
    assert event['card']['title'] == 'A Fork In The Road'
    assert event['characterUuid'] == 'c1'
    assert event['characterName'] == 'Ranger'


def test_step39_random_event_entry_carries_the_event_card():
    rows = [_row(1, 'RANDOM_EVENT', 5000, clock=4, idEvent=90010,
                 message='random event 90010 (RANDOM_EVENT)')]
    body = _body(_call(_player_event(), _enrich_table(rows)))
    entry = next(e for e in body['logs'] if e['type'] == 'RANDOM_EVENT')
    assert entry['idEvent'] == 90010
    assert entry['card']['title'] == 'A Fork In The Road'


def test_entries_without_a_card_resolve_to_null():
    # The default match points at no story at all.
    body = _body(_call(_player_event(), _table()))
    weather = next(e for e in body['logs'] if e['type'] == 'WEATHER')
    assert weather['idCard'] is None
    assert weather['card'] is None


# ── v0.35.4: items and resource gains ───────────────────────────────────────

def test_v0354_item_rows_are_item_entries_with_their_card():
    rows = [
        _row(1, 'ITEM_ADD', 1000, clock=1, characterUuid='c1', idItem=900, itemAction='ADD',
             counter=1, idEvent=42),
        _row(2, 'ITEM_USE', 2000, clock=2, characterUuid='c1', idItem=900, itemAction='USE',
             counter=2, idEvent=None, energyGain=9, magicCost=3),
        _row(3, 'ITEM_DROP', 3000, clock=2, characterUuid='c1', idItem=901,
             itemAction='remove', counter=1, idEvent=43),
    ]
    logs = _body(_call(_player_event(), _enrich_table(rows)))['logs']

    # REMOVE and DROP share one type; the raw action survives for whoever needs it.
    assert [e['type'] for e in logs] == ['ITEM_ADD', 'ITEM_USE', 'ITEM_DROP']
    assert logs[0]['idItem'] == 900 and logs[0]['idEvent'] == 42
    assert logs[1]['counter'] == 2 and logs[1]['idEvent'] is None
    assert logs[2]['itemAction'] == 'remove'
    # The cost/gain halves were split when the row was written.
    assert logs[1]['energyGain'] == 9 and logs[1]['energyCost'] == 0
    assert logs[1]['magicCost'] == 3 and logs[1]['magicGain'] == 0
    # An item entry is narrated by the item's own card.
    assert logs[0]['idCard'] == 800 and logs[0]['card']['title'] == 'Old Lantern'
    assert logs[2]['card'] is None


def test_v0354_an_event_row_reports_what_it_gave_beside_what_it_took():
    rows = [_row(1, 'EVENT', 1000, clock=2, characterUuid='c1', idEvent=42,
                 message='EVENT_EXECUTED 42', energyCost=5, coinCost=7, foodGain=2,
                 coinGain=30)]
    entry = _body(_call(_player_event(), _table(rows=rows)))['logs'][0]
    assert (entry['energyCost'], entry['coinCost']) == (5, 7)
    assert (entry['foodGain'], entry['coinGain']) == (2, 30)
    assert (entry['energyGain'], entry['magicGain']) == (0, 0)


def test_v0354_every_entry_carries_the_eight_resource_fields_whatever_its_type():
    """The Java reference has always answered this shape; a stored row missing a resource
    key (none should) still reads as 0."""
    rows = [dict(r) for r in BASE_ROWS]
    rows[0].pop('energyCost', None)
    logs = _body(_call(_player_event(), _table(rows=rows)))['logs']

    assert len(logs) > 1
    for entry in logs:
        for name in ('energy', 'food', 'magic', 'coin'):
            assert entry[f'{name}Cost'] is not None, f"{name}Cost missing on {entry['type']}"
            assert entry[f'{name}Gain'] is not None, f"{name}Gain missing on {entry['type']}"
    weather = next(e for e in logs if e['type'] == 'WEATHER')
    assert (weather['energyCost'], weather['coinGain']) == (0, 0)


# ── v0.37.2 — a mission row is narrated by the mission's own card ─────────────

def _mission_entry(message):
    rows = [_row(1, 'MISSION_CHANGE', 1000, clock=4, message=message, characterUuid=None,
                 idEvent=None)]
    return next(e for e in _body(_call(_player_event(), _enrich_table(rows)))['logs']
                if e['type'] == 'MISSION_CHANGE')


def test_v0372_a_row_about_the_mission_itself_carries_the_missions_card():
    # No step named: the mission opening, or the row that says it is over.
    entry = _mission_entry('MISSION_CHANGE m-1 none -> AVAILABLE')
    # The uuid in the message is the only handle the row has: no mission column exists.
    assert entry['idCard'] == 700
    assert entry['card']['title'] == 'The Journey'


def test_v0372_a_row_that_names_a_step_carries_the_steps_card():
    entry = _mission_entry('MISSION_CHANGE m-1 AVAILABLE -> ACTIVE step 7')
    # An advance is the STEP's news; the mission's card is for its opening and its end.
    assert entry['idCard'] == 701
    assert entry['card']['title'] == 'Reach the hills'


def test_v0372_a_step_the_story_does_not_declare_leaves_the_row_without_a_card():
    entry = _mission_entry('MISSION_CHANGE m-1 AVAILABLE -> ACTIVE step 9')
    # It does NOT fall back to the mission's card: that would narrate an advance with the
    # wrong picture.
    assert entry['card'] is None


def test_v0372_an_unknown_mission_and_a_shapeless_message_carry_no_card():
    for message in ('MISSION_CHANGE m-9 none -> AVAILABLE', 'MISSION_CHANGE'):
        assert _mission_entry(message)['card'] is None, message
