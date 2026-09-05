"""Direct unit tests for pure helpers in match/handler.py that the route-level
tests do not reach: admin IP whitelisting, weather rule matching / weighted pick,
weather name resolution and the visited-locations payload edge cases."""
import json
from unittest.mock import patch

from helpers import make_event


def _h():
    from match import handler
    return handler


def _ip_event(ip):
    return {'requestContext': {'http': {'method': 'GET', 'sourceIp': ip}}, 'headers': {}}


# ── _check_admin_ip ──────────────────────────────────────────────────────────

def test_check_admin_ip_no_whitelist_allows():
    h = _h()
    with patch.dict('os.environ', {'ADMIN_IP_WHITELIST': ''}, clear=False):
        assert h._check_admin_ip(_ip_event('1.2.3.4')) is None


def test_check_admin_ip_whitelist_of_only_separators_allows():
    """A whitelist that is non-empty but parses to zero entries is treated as absent."""
    h = _h()
    with patch.dict('os.environ', {'ADMIN_IP_WHITELIST': ' , , '}, clear=False):
        assert h._check_admin_ip(_ip_event('1.2.3.4')) is None


def test_check_admin_ip_allows_listed_ip():
    h = _h()
    with patch.dict('os.environ', {'ADMIN_IP_WHITELIST': '9.9.9.9, 1.2.3.4'}, clear=False):
        assert h._check_admin_ip(_ip_event('1.2.3.4')) is None


def test_check_admin_ip_rejects_unlisted_ip():
    h = _h()
    with patch.dict('os.environ', {'ADMIN_IP_WHITELIST': '9.9.9.9'}, clear=False):
        result = h._check_admin_ip(_ip_event('1.2.3.4'))
        assert result['statusCode'] == 403
        assert json.loads(result['body'])['error'] == 'FORBIDDEN'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'a1', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item',
       return_value={'PK': 'USER#a1', 'uuid': 'a1', 'role': 'ADMIN', 'state': 1})
def test_admin_route_blocked_by_ip_whitelist(_get, _jwt):
    h = _h()
    ev = make_event('GET', '/api/admin/matches',
                    headers={'Authorization': 'Bearer MOCK_ACCESS_a1'})
    ev['requestContext']['http']['sourceIp'] = '8.8.8.8'
    with patch.dict('os.environ', {'ADMIN_IP_WHITELIST': '1.1.1.1'}, clear=False):
        result = h.lambda_handler(ev, {})
    assert result['statusCode'] == 403


# ── weather rule matching ────────────────────────────────────────────────────

def test_weather_time_matches_before_window():
    h = _h()
    assert h._weather_time_matches({'timeStart': 5, 'timeEnd': 9}, 3) is False
    assert h._weather_time_matches({'timeStart': 5, 'timeEnd': 9}, 7) is True
    assert h._weather_time_matches({'timeStart': None, 'timeEnd': None}, 42) is True


def test_weather_condition_no_key_always_matches():
    h = _h()
    assert h._weather_condition_matches({}, [{'key': 'k', 'stringValue': 'v'}]) is True


def test_weather_condition_matches_string_registry_value():
    h = _h()
    rule = {'conditionKey': 'season', 'conditionValue': 'WINTER'}
    assert h._weather_condition_matches(rule, [{'key': 'season', 'stringValue': 'WINTER'}]) is True
    assert h._weather_condition_matches(rule, [{'key': 'season', 'stringValue': 'SUMMER'}]) is False


def test_weather_condition_matches_int_registry_value_as_string():
    h = _h()
    rule = {'conditionKey': 'phase', 'conditionValue': '3'}
    assert h._weather_condition_matches(rule, [{'key': 'phase', 'intValue': 3}]) is True


def test_weather_condition_with_no_expected_value_is_never_met():
    """Step 36 — this used to read as "the key must be unset". A condition that names a key
    but no value is now never met, the reading events and movement always had. Say "unset"
    with != instead."""
    h = _h()
    assert h._weather_condition_matches({'conditionKey': 'x', 'conditionValue': None}, []) is False
    assert h._weather_condition_matches({'conditionKey': 'x', 'conditionValue': 'y'}, []) is False


def test_weather_condition_unset_key_is_expressed_with_not_equals():
    h = _h()
    rule = {'conditionKey': 'x', 'conditionValue': 'y',
            'registryValueOperatorCondition': '!='}
    assert h._weather_condition_matches(rule, []) is True


def test_weather_condition_registry_none():
    h = _h()
    # No key at all is still no condition, whatever the registry holds.
    assert h._weather_condition_matches({}, None) is True
    assert h._weather_condition_matches({'conditionKey': 'x'}, None) is False


# ── weighted pick ────────────────────────────────────────────────────────────

def test_weather_weighted_pick_zero_total_returns_first():
    h = _h()
    rules = [{'id': 2, 'probability': 0}, {'id': 1, 'probability': 0}]
    assert h._weather_weighted_pick(rules, 7)['id'] == 1  # sorted by id


def test_weather_weighted_pick_picks_a_rule():
    h = _h()
    rules = [{'id': 1, 'probability': 1}, {'id': 2, 'probability': 1}]
    for seed in range(20):
        assert h._weather_weighted_pick(rules, seed)['id'] in (1, 2)


def test_weather_weighted_pick_single_rule_is_always_chosen():
    h = _h()
    assert h._weather_weighted_pick([{'id': 5, 'probability': 3}], 11)['id'] == 5


# ── weather name / payload resolution ────────────────────────────────────────

def test_resolve_weather_name_falls_back_to_card_title():
    h = _h()
    raw_cards = [{'id': 10, 'idTextTitle': 100}]
    raw_texts = [{'idText': 100, 'lang': 'en', 'shortText': 'Storm'}]
    name = h._resolve_weather_name(raw_cards, raw_texts, None, 10, 'en')
    assert name == 'Storm'


def test_resolve_weather_name_none_when_nothing_resolves():
    h = _h()
    assert h._resolve_weather_name([], [], None, None, 'en') is None


def test_current_weather_payload_none_when_id_absent():
    h = _h()
    assert h._current_weather_payload({}, {'weatherRules': []}) is None


def test_current_weather_payload_none_when_rule_dangling():
    h = _h()
    match = {'currentWeatherId': 99}
    assert h._current_weather_payload(match, {'weatherRules': [{'id': 1}]}) is None


# ── visited-locations payload edge cases ─────────────────────────────────────

STORY = {
    'locations': [
        {'id': 1, 'uuid': 'L1', 'idCard': None, 'secureParam': 1},
        {'id': 2, 'uuid': 'L2', 'idCard': None, 'secureParam': 0},
    ],
    'neighbors': [
        # 2 → 1 reverse traversal (character stands on 1)
        {'idLocationFrom': 2, 'idLocationTo': 1, 'energyCost': 3, 'flagBack': 1,
         'conditionKey': 'gate', 'conditionValue': 'OPEN'},
        # unrelated link: neither end is location 1
        {'idLocationFrom': 7, 'idLocationTo': 8, 'energyCost': 1},
        # dangling target: location 42 is not in the story
        {'idLocationFrom': 1, 'idLocationTo': 42, 'energyCost': 1},
    ],
    'raw_cards': [],
    'raw_texts': [],
}


@patch('match.handler._match_characters')
@patch('match.handler.db_utils.get_item')
def test_visited_locations_payload_covers_neighbor_edges(mock_get, mock_chars):
    h = _h()
    mock_get.return_value = STORY
    mock_chars.return_value = [{'uuid': 'c1', 'idLocation': 1}]
    match = {'storyUuid': 's1', 'registry': [{'key': 'gate', 'stringValue': 'OPEN'}],
             'movementLog': [{'idLocationFrom': 1, 'idLocationTo': 999}]}
    payload = h._visited_locations_payload(match, 'm1', 'en')
    # location 999 is unknown → skipped (the `loc is None: continue` branch)
    assert [loc['idLocation'] for loc in payload['locations']] == [1]
    loc1 = payload['locations'][0]
    assert loc1['characterCount'] == 1
    assert loc1['safe'] is True
    # only the reverse-traversable 2→1 link survives; 42 is dangling, 7→8 unrelated
    assert [n['idLocation'] for n in loc1['neighbors']] == [2]
    assert loc1['neighbors'][0]['conditionMet'] is True


@patch('match.handler._match_characters')
@patch('match.handler.db_utils.get_item')
def test_visited_locations_payload_condition_not_met(mock_get, mock_chars):
    h = _h()
    mock_get.return_value = STORY
    mock_chars.return_value = [{'uuid': 'c1', 'idLocation': 1}]
    match = {'storyUuid': 's1', 'registry': [{'key': 'gate', 'stringValue': 'SHUT'}]}
    payload = h._visited_locations_payload(match, 'm1', 'en')
    assert payload['locations'][0]['neighbors'][0]['conditionMet'] is False


# ── _get_admin_locations validation ──────────────────────────────────────────

def test_get_admin_locations_requires_uuid():
    h = _h()
    result = h._get_admin_locations('   ', 'en')
    assert result['statusCode'] == 400
    assert json.loads(result['body'])['error'] == 'INVALID_INPUT'


@patch('match.handler.db_utils.get_item', return_value=None)
def test_get_admin_locations_match_not_found(_get):
    h = _h()
    result = h._get_admin_locations('nope', 'en')
    assert result['statusCode'] == 404


def test_visited_location_ids_unions_the_roster_and_the_movement_log():
    """Where the party stands now, plus both endpoints of every move it has ever made."""
    from unittest.mock import patch as _patch

    import match.handler as mh

    match = {'movementLog': [{'idLocationFrom': 1, 'idLocationTo': 2},
                             {'idLocationFrom': 2, 'idLocationTo': 3},
                             {'idLocationFrom': None, 'idLocationTo': None}]}
    with _patch.object(mh, '_match_characters',
                       return_value=[{'idLocation': 2}, {'idLocation': None}, {'idLocation': 5}]):
        assert mh._visited_location_ids(match, 'm1') == [2, 5, 1, 3]
