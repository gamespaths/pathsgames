"""Coverage for the Step 28.7 match logs routes in match/handler.py.

GET /api/matches/{uuid}/logs        — owner-only consolidated timeline
GET /api/admin/matches/{uuid}/logs  — same payload, no ownership check

jwt_utils and db_utils are patched; no AWS calls are made.
"""
import json
from unittest.mock import patch

from helpers import make_event

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'guest', 'role': 'PLAYER'}
ADMIN_USER = {'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001',
              'username': 'admin', 'role': 'ADMIN'}

MATCH = {
    'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
    'currentClock': 2, 'userCreatorUuid': 'u1',
    'weatherLog': [{'clock': 1, 'idWeather': 3, 'timestampStart': 1000}],
    'movementLog': [{'characterUuid': 'c1', 'idLocationFrom': 1, 'idLocationTo': 2,
                     'energyCost': 4, 'timestampStart': 2000}],
    'sleepLog': [{'characterUuid': 'c1', 'clock': 1, 'timestamp': 3000}],
}

CLOCK_ITEMS = [
    {'PK': 'MATCH#m1', 'SK': 'METADATA'},              # the match item itself — skipped
    {'PK': 'MATCH#m1', 'SK': 'CLOCK#2', 'clock': 2, 'timestampStart': 4000},
]


def _body(result):
    return json.loads(result['body'])


def _call(event):
    from match.handler import lambda_handler
    return lambda_handler(event, {})


def _get_side(match_item=MATCH, user=USER):
    def _side(pk, sk='METADATA'):
        if pk.startswith('USER#'):
            return user
        if pk.startswith('MATCH#'):
            return match_item
        return None
    return _side


def _player_event(uuid='m1'):
    return make_event('GET', f'/api/matches/{uuid}/logs',
                      headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                      path_params={'uuidMatch': uuid})


def _admin_event(uuid='m1'):
    return make_event('GET', f'/api/admin/matches/{uuid}/logs',
                      headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                      path_params={'uuidMatch': uuid})


# ── _ms_to_iso ──────────────────────────────────────────────────────────────

def test_ms_to_iso_converts_and_handles_none_and_garbage():
    from match.handler import _ms_to_iso
    assert _ms_to_iso(None) is None
    assert _ms_to_iso(1000).startswith('1970-01-01T00:00:01')
    assert _ms_to_iso('not-a-number') == 'not-a-number'


# ── player endpoint ─────────────────────────────────────────────────────────

@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=CLOCK_ITEMS)
@patch('match.handler.db_utils.get_item')
def test_get_match_logs_returns_full_timeline(mock_get, _q, _jwt):
    mock_get.side_effect = _get_side()
    result = _call(_player_event())
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['matchUuid'] == 'm1'
    assert body['currentClock'] == 2
    # Sorted by timestamp ascending across all four sources.
    assert [e['type'] for e in body['logs']] == [
        'WEATHER', 'MOVEMENT', 'SLEEP', 'CLOCK_ADVANCE',
    ]
    weather, movement = body['logs'][0], body['logs'][1]
    assert weather['idWeather'] == 3
    assert movement['idLocationTo'] == 2 and movement['energyCost'] == 4


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=[])
@patch('match.handler.db_utils.get_item')
def test_get_match_logs_empty_match_returns_empty_list(mock_get, _q, _jwt):
    mock_get.side_effect = _get_side(match_item={
        'uuid': 'm1', 'userCreatorUuid': 'u1', 'currentClock': 0,
    })
    result = _call(_player_event())
    assert result['statusCode'] == 200
    assert _body(result)['logs'] == []


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.get_item')
def test_get_match_logs_unknown_match_returns_404(mock_get, _jwt):
    mock_get.side_effect = _get_side(match_item=None)
    result = _call(_player_event('nope'))
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.get_item')
def test_get_match_logs_of_another_user_returns_404(mock_get, _jwt):
    mock_get.side_effect = _get_side(match_item={**MATCH, 'userCreatorUuid': 'someone-else'})
    result = _call(_player_event())
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


# ── v0.30.3: EVENT filtering + idEvent ───────────────────────────────────────

EVENT_MATCH = {**MATCH, 'eventLog': [
    {'characterUuid': 'c1', 'idEvent': 90010, 'clock': 3,
     'timestamp': 5000, 'message': 'EVENT_EXECUTED 90010'},
    # Step 30 edge-state audit rows share the same list — must not surface as EVENT.
    {'characterUuid': 'c1', 'idEvent': None, 'clock': 3,
     'timestamp': 5100, 'message': 'SADNESS_OVERFLOW c1'},
    {'characterUuid': 'c1', 'idEvent': None, 'clock': 3,
     'timestamp': 5200, 'message': 'COMA c1'},
]}


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=[])
@patch('match.handler.db_utils.get_item')
def test_edge_state_rows_are_skipped_not_shown_as_event(mock_get, _q, _jwt):
    mock_get.side_effect = _get_side(match_item=EVENT_MATCH)
    body = _body(_call(_player_event()))
    events = [e for e in body['logs'] if e['type'] == 'EVENT']
    assert len(events) == 1
    assert events[0]['idEvent'] == 90010
    assert events[0]['message'] == 'EVENT_EXECUTED 90010'


def test_get_match_logs_without_token_returns_401():
    result = _call(make_event('GET', '/api/matches/m1/logs',
                              path_params={'uuidMatch': 'm1'}))
    assert result['statusCode'] == 401


# ── admin endpoint ──────────────────────────────────────────────────────────

@patch('match.handler._check_admin_ip', return_value=None)
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.query_by_pk', return_value=CLOCK_ITEMS)
@patch('match.handler.db_utils.get_item')
def test_admin_logs_skips_the_ownership_check(mock_get, _q, _jwt, _ip):
    # The match belongs to u1, the caller is the admin — still 200.
    mock_get.side_effect = _get_side(user=ADMIN_USER)
    result = _call(_admin_event())
    assert result['statusCode'] == 200
    assert _body(result)['matchUuid'] == 'm1'


@patch('match.handler._check_admin_ip', return_value=None)
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item')
def test_admin_logs_blank_uuid_returns_400(mock_get, _jwt, _ip):
    mock_get.side_effect = _get_side(user=ADMIN_USER)
    result = _call(make_event('GET', '/api/admin/matches/ /logs',
                              headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                              path_params={'uuidMatch': ' '}))
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


@patch('match.handler._check_admin_ip', return_value=None)
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item')
def test_admin_logs_unknown_match_returns_404(mock_get, _jwt, _ip):
    def _side(pk, sk='METADATA'):
        return ADMIN_USER if pk.startswith('USER#') else None
    mock_get.side_effect = _side
    result = _call(_admin_event('nope'))
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


# ── v0.28.7: cursor pagination ──────────────────────────────────────────────

def _clock_match(count):
    """A match whose timeline is `count` CLOCK_ADVANCE entries."""
    return {**MATCH, 'weatherLog': [], 'movementLog': [], 'sleepLog': []}


def _clock_items(count):
    return [{'PK': 'MATCH#m1', 'SK': f'CLOCK#{i}', 'clock': i,
             'timestampStart': 1000 * (i + 1)} for i in range(count)]


def test_cursor_helpers_round_trip():
    from match.handler import _decode_logs_cursor, _encode_logs_cursor
    assert _decode_logs_cursor(_encode_logs_cursor(42)) == 42
    assert _decode_logs_cursor(None) == 0
    assert _decode_logs_cursor('') == 0
    assert _decode_logs_cursor('###') == 0


def test_clamp_limit_bounds():
    from match.handler import (LOGS_DEFAULT_LIMIT, LOGS_MAX_LIMIT, _clamp_logs_limit)
    assert _clamp_logs_limit(None) == LOGS_DEFAULT_LIMIT
    assert _clamp_logs_limit('') == LOGS_DEFAULT_LIMIT
    assert _clamp_logs_limit('not-a-number') == LOGS_DEFAULT_LIMIT
    assert _clamp_logs_limit(9999) == LOGS_MAX_LIMIT
    assert _clamp_logs_limit(0) == 1
    assert _clamp_logs_limit('10') == 10


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=_clock_items(5))
@patch('match.handler.db_utils.get_item')
def test_first_page_is_capped_and_exposes_next_cursor(mock_get, _q, _jwt):
    mock_get.side_effect = _get_side(match_item=_clock_match(5))
    ev = _player_event()
    ev['queryStringParameters'] = {'limit': '2'}
    body = _body(_call(ev))

    assert len(body['logs']) == 2
    assert body['limit'] == 2
    assert body['total'] == 5
    assert body['nextCursor'] is not None
    assert [e['clock'] for e in body['logs']] == [0, 1]


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=_clock_items(5))
@patch('match.handler.db_utils.get_item')
def test_next_cursor_walks_to_the_end_then_goes_none(mock_get, _q, _jwt):
    mock_get.side_effect = _get_side(match_item=_clock_match(5))

    def page(cursor=None):
        ev = _player_event()
        ev['queryStringParameters'] = {'limit': '2'}
        if cursor:
            ev['queryStringParameters']['cursor'] = cursor
        return _body(_call(ev))

    p1 = page()
    p2 = page(p1['nextCursor'])
    p3 = page(p2['nextCursor'])

    assert [e['clock'] for e in p2['logs']] == [2, 3]
    assert [e['clock'] for e in p3['logs']] == [4]
    assert p3['nextCursor'] is None


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=_clock_items(2))
@patch('match.handler.db_utils.get_item')
def test_offset_past_the_end_returns_an_empty_page(mock_get, _q, _jwt):
    from match.handler import _encode_logs_cursor

    mock_get.side_effect = _get_side(match_item=_clock_match(2))
    ev = _player_event()
    ev['queryStringParameters'] = {'limit': '2', 'cursor': _encode_logs_cursor(99)}
    body = _body(_call(ev))

    assert body['logs'] == []
    assert body['nextCursor'] is None
    assert body['total'] == 2


# ── order=asc|desc ──────────────────────────────────────────────────────────

def test_normalize_order_accepts_only_desc():
    from match.handler import _normalize_logs_order
    assert _normalize_logs_order(None) == 'asc'
    assert _normalize_logs_order('') == 'asc'
    assert _normalize_logs_order('nonsense') == 'asc'
    assert _normalize_logs_order('asc') == 'asc'
    assert _normalize_logs_order('desc') == 'desc'
    assert _normalize_logs_order('  DESC ') == 'desc'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=_clock_items(5))
@patch('match.handler.db_utils.get_item')
def test_desc_starts_from_the_newest_entry(mock_get, _q, _jwt):
    mock_get.side_effect = _get_side(match_item=_clock_match(5))
    ev = _player_event()
    ev['queryStringParameters'] = {'order': 'desc'}
    body = _body(_call(ev))

    assert body['order'] == 'desc'
    assert [e['clock'] for e in body['logs']] == [4, 3, 2, 1, 0]


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=_clock_items(5))
@patch('match.handler.db_utils.get_item')
def test_desc_cursor_walks_towards_the_older_entries(mock_get, _q, _jwt):
    mock_get.side_effect = _get_side(match_item=_clock_match(5))

    def page(cursor=None):
        ev = _player_event()
        ev['queryStringParameters'] = {'limit': '2', 'order': 'desc'}
        if cursor:
            ev['queryStringParameters']['cursor'] = cursor
        return _body(_call(ev))

    p1 = page()
    p2 = page(p1['nextCursor'])
    assert [e['clock'] for e in p1['logs']] == [4, 3]
    assert [e['clock'] for e in p2['logs']] == [2, 1]


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=CLOCK_ITEMS)
@patch('match.handler.db_utils.get_item')
def test_desc_reverses_entries_of_every_type(mock_get, _q, _jwt):
    mock_get.side_effect = _get_side()
    ev = _player_event()
    ev['queryStringParameters'] = {'order': 'desc'}
    body = _body(_call(ev))
    assert [e['type'] for e in body['logs']] == [
        'CLOCK_ADVANCE', 'SLEEP', 'MOVEMENT', 'WEATHER',
    ]


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=_clock_items(3))
@patch('match.handler.db_utils.get_item')
def test_unknown_order_falls_back_to_ascending(mock_get, _q, _jwt):
    mock_get.side_effect = _get_side(match_item=_clock_match(3))
    ev = _player_event()
    ev['queryStringParameters'] = {'order': 'sideways'}
    body = _body(_call(ev))

    assert body['order'] == 'asc'
    assert [e['clock'] for e in body['logs']] == [0, 1, 2]


@patch('match.handler._check_admin_ip', return_value=None)
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.query_by_pk', return_value=_clock_items(3))
@patch('match.handler.db_utils.get_item')
def test_admin_endpoint_honours_the_order_too(mock_get, _q, _jwt, _ip):
    mock_get.side_effect = _get_side(match_item=_clock_match(3), user=ADMIN_USER)
    ev = _admin_event()
    ev['queryStringParameters'] = {'order': 'desc'}
    body = _body(_call(ev))
    assert [e['clock'] for e in body['logs']] == [2, 1, 0]


# ── v0.28.7: card + character enrichment ────────────────────────────────────

STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
    'weatherRules': [{'id': 3, 'uuid': 'w-3', 'idCard': 300}],
    'locations': [{'id': 2, 'uuid': 'loc-2', 'idCard': 400}],
    'characterTemplates': [{'uuid': 'tpl-9', 'idCard': 500}],
    'events': [{'id': 90010, 'idCard': 600}],
    'raw_cards': [
        {'id': 300, 'uuid': 'card-300', 'idTextTitle': 1},
        {'id': 400, 'uuid': 'card-400', 'idTextTitle': 2},
        {'id': 500, 'uuid': 'card-500', 'idTextTitle': 3},
        {'id': 600, 'uuid': 'card-600', 'idTextTitle': 4},
    ],
    'raw_texts': [
        {'idText': 1, 'lang': 'en', 'shortText': 'Thunderstorm'},
        {'idText': 2, 'lang': 'en', 'shortText': 'Dark Forest'},
        {'idText': 3, 'lang': 'en', 'shortText': 'Ranger'},
        {'idText': 4, 'lang': 'en', 'shortText': 'A Fork In The Road'},
    ],
}

ENRICH_MATCH = {**MATCH, 'storyUuid': 's1'}
CHARACTER = {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1',
             'characterTemplateUuid': 'tpl-9'}


def _enrich_side(pk, sk='METADATA'):
    if pk.startswith('USER#'):
        return USER
    if pk.startswith('STORY#'):
        return STORY
    if pk.startswith('MATCH#'):
        return ENRICH_MATCH
    return None


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=[CHARACTER])
@patch('match.handler.db_utils.get_item', side_effect=_enrich_side)
def test_weather_and_movement_entries_carry_their_cards(_get, _q, _jwt):
    body = _body(_call(_player_event()))

    weather = next(e for e in body['logs'] if e['type'] == 'WEATHER')
    assert weather['idCard'] == 300
    assert weather['card']['title'] == 'Thunderstorm'

    movement = next(e for e in body['logs'] if e['type'] == 'MOVEMENT')
    assert movement['idCard'] == 400
    assert movement['card']['title'] == 'Dark Forest'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=[CHARACTER])
@patch('match.handler.db_utils.get_item', side_effect=_enrich_side)
def test_movement_entry_names_the_character_that_moved(_get, _q, _jwt):
    body = _body(_call(_player_event()))
    movement = next(e for e in body['logs'] if e['type'] == 'MOVEMENT')
    assert movement['characterUuid'] == 'c1'
    assert movement['characterName'] == 'Ranger'


ENRICH_EVENT_MATCH = {**ENRICH_MATCH, 'eventLog': EVENT_MATCH['eventLog']}


def _enrich_event_side(pk, sk='METADATA'):
    if pk.startswith('USER#'):
        return USER
    if pk.startswith('STORY#'):
        return STORY
    if pk.startswith('MATCH#'):
        return ENRICH_EVENT_MATCH
    return None


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=[CHARACTER])
@patch('match.handler.db_utils.get_item', side_effect=_enrich_event_side)
def test_event_entry_carries_its_own_card_and_character(_get, _q, _jwt):
    body = _body(_call(_player_event()))
    event = next(e for e in body['logs'] if e['type'] == 'EVENT')
    assert event['idEvent'] == 90010
    assert event['idCard'] == 600
    assert event['card']['title'] == 'A Fork In The Road'
    assert event['characterUuid'] == 'c1'
    assert event['characterName'] == 'Ranger'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.query_by_pk', return_value=CLOCK_ITEMS)
@patch('match.handler.db_utils.get_item')
def test_entries_without_a_card_resolve_to_null(mock_get, _q, _jwt):
    # The default MATCH points at a story that get_item does not return.
    mock_get.side_effect = _get_side()
    body = _body(_call(_player_event()))
    weather = next(e for e in body['logs'] if e['type'] == 'WEATHER')
    assert weather['idCard'] is None
    assert weather['card'] is None
