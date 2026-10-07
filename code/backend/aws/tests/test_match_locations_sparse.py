"""v0.37.5 — the match's location state is sparse: only the start location and the ones
with a counter get a row at creation, a visit adds one, the API still lists them all."""
import json
from unittest.mock import patch

import helpers
from helpers import make_event
from match import handler as h

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'p', 'role': 'PLAYER', 'state': 2}
STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1', 'idLocationStart': 1,
    'difficulties': [{'uuid': 'd1', 'expCost': 5, 'minCharacter': 1, 'maxCharacter': 2}],
    'locations': [
        {'id': 1, 'uuid': 'loc-1', 'counterTime': 0},
        {'id': 2, 'uuid': 'loc-2', 'counterTime': 5},
        {'id': 3, 'uuid': 'loc-3', 'counterTime': 0},
    ],
    'keys': [], 'raw_cards': [], 'raw_texts': [],
}


def _body(result):
    return json.loads(result['body'])


def _jwt():
    return patch('match.handler.jwt_utils.verify_access_token',
                 return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})


def _get(pk, sk='METADATA', consistent=True):
    if pk.startswith('USER#'):
        return USER
    if pk.startswith('STORY#'):
        return STORY
    return None


def test_creation_stores_only_the_start_and_the_counted_locations():
    with _jwt(), patch('match.handler.db_utils.get_item', side_effect=_get), \
         patch('match.handler.db_utils.query_gsi', return_value=[]):
        result = h.lambda_handler(make_event(
            'POST', '/api/matches', body={'storyUuid': 's1', 'difficultyUuid': 'd1'},
            headers={'Authorization': 'Bearer MOCK_ACCESS_u1'}), {})
    assert result['statusCode'] == 201, result
    saved = helpers.SINK.saved()
    rows = {r['idLocation']: r for r in saved['locations']}
    assert set(rows) == {1, 2}
    assert rows[1]['flagVisited'] == 1 and rows[1]['clockCounter'] == 0
    assert rows[2]['flagVisited'] == 0 and rows[2]['clockCounter'] == 5
    # The uuid of a row is a function of match and location, so a synthesized entry
    # (a location without a row) always answers with the same one.
    assert rows[1]['uuid'] == h._location_state(saved['uuid'], 1)['uuid']
    assert rows[1]['uuid'] != rows[2]['uuid']


def test_a_visit_adds_the_missing_row_and_marks_an_existing_one():
    match = {'uuid': 'm1', 'locations': [h._location_state('m1', 2, 0, 5)]}
    assert h._flag_visited(match, 3) == 0
    h._mark_location_visited(match, 3)
    assert h._flag_visited(match, 3) == 1
    assert [l['idLocation'] for l in match['locations']] == [2, 3]
    h._mark_location_visited(match, 3)  # idempotent
    assert len(match['locations']) == 2
    h._mark_location_visited(match, 2)
    assert match['locations'][0]['flagVisited'] == 1 and match['locations'][0]['clockCounter'] == 5


def test_the_full_list_synthesizes_all_zero_entries_for_the_rest():
    match = {'uuid': 'm1', 'locations': [h._location_state('m1', 2, 0, 5)]}
    full = h._location_states_full(match, STORY)
    assert [l['idLocation'] for l in full] == [1, 2, 3]
    assert full[1] is match['locations'][0]
    assert full[0] == {'idLocation': 1, 'uuid': full[0]['uuid'], 'flagAlreadyActived': 0,
                       'flagVisited': 0, 'clockCounter': 0}
    assert h._location_states_full({'uuid': 'm1'}, {}) == []


def _info(match, path='/api/match/m1/info'):
    char = {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'userUuid': 'u1', 'idLocation': 1}

    def get(pk, sk='METADATA', consistent=True):
        return match if pk == 'MATCH#m1' else _get(pk, sk, consistent)

    with _jwt(), patch('match.handler.db_utils.get_item', side_effect=get), \
         patch('match.handler.db_utils.query_sk_prefix', return_value=[char]):
        result = h.lambda_handler(make_event(
            'GET', path, headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
            path_params={'uuidMatch': 'm1'}), {})
    assert result['statusCode'] == 200, result
    return _body(result)


def test_info_answers_the_visited_locations_from_the_sparse_state():
    match = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'storyUuid': 's1',
             'status': 'RUNNING', 'userCreatorUuid': 'u1', 'registry': [],
             'visitedLocationIds': [1, 3],
             'locations': [h._location_state('m1', 1, 1, 0), h._location_state('m1', 2, 0, 5)]}
    body = _info(match)
    # The player sees every VISITED location — the one with a row and the one without.
    assert sorted(l['idLocation'] for l in body['locations']) == [1, 3]
    assert next(l for l in body['locations'] if l['idLocation'] == 3)['flagVisited'] == 0


def test_admin_info_lists_every_story_location():
    match = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'storyUuid': 's1',
             'status': 'RUNNING', 'userCreatorUuid': 'u1', 'registry': [],
             'locations': [h._location_state('m1', 2, 0, 5)]}
    with patch('match.handler.db_utils.get_item',
               side_effect=lambda pk, sk='METADATA', consistent=True: match if pk == 'MATCH#m1' else _get(pk)), \
         patch('match.handler.db_utils.query_sk_prefix', return_value=[]):
        result = h._get_admin_match_info('m1')
    body = _body(result)
    assert [l['idLocation'] for l in body['locations']] == [1, 2, 3]
    assert [l['clockCounter'] for l in body['locations']] == [0, 5, 0]
