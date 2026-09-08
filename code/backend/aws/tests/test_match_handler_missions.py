"""Step 37 — GET /api/match/{uuidMatch}/missions[/{uuidMission}] on the AWS backend."""
import json
from unittest.mock import patch

from helpers import make_event

PLAYER_USER = {'uuid': 'player-uuid-001', 'role': 'PLAYER', 'status': 'ACTIVE'}

MATCH = {
    'uuid': 'm1', 'storyUuid': 's1', 'userCreatorUuid': 'player-uuid-001',
    'status': 'RUNNING', 'currentClock': 3,
    'registry': [
        {'id': 1, 'key': 'tutorial_progress', 'stringValue': '1', 'intValue': None},
        # Step 37 — the bookkeeping row: reached, one step closed, and never a registry key.
        {'id': 2, 'key': 'mission:mis-1', 'stringValue': 'ACTIVE', 'intValue': None,
         'idMission': 1, 'idMissionSteps': 10},
    ],
}
STORY = {
    'uuid': 's1',
    'keys': [{'keyName': 'tutorial_progress', 'keyGroup': 'tutorial',
              'visibility': 'PUBLIC', 'priority': 1}],
    'missions': [{'id': 1, 'uuid': 'mis-1', 'conditionKey': 'tutorial_progress',
                  'conditionValue': '1', 'idTextName': 900},
                 {'id': 2, 'uuid': 'mis-2', 'conditionKey': 'never', 'conditionValue': '1'}],
    'missionSteps': [
        {'id': 10, 'uuid': 'mst-1', 'idMission': 1, 'step': 1, 'conditionKey': 'a',
         'conditionValue': '1'},
        {'id': 11, 'uuid': 'mst-2', 'idMission': 1, 'step': 2, 'conditionKey': 'b',
         'conditionValue': '1'},
    ],
    'raw_texts': [{'idText': 900, 'lang': 'en', 'shortText': 'Complete the Tutorial'}],
    'raw_cards': [],
}


def _player_event(method, path, path_params=None, qs=None):
    return make_event(method, path, headers={'Authorization': 'Bearer MOCK_ACCESS_player'},
                      path_params=path_params, qs=qs)


def _get_side(match=MATCH, story=STORY):
    def side(pk, sk='METADATA'):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        if pk == 'MATCH#m1':
            return match
        if pk == 'STORY#s1':
            return story
        return None
    return side


def _call(event, match=MATCH):
    with patch('match.handler.db_utils.get_item') as get_item, \
            patch('match.handler.jwt_utils.verify_access_token', return_value=PLAYER_USER):
        get_item.side_effect = _get_side(match)
        from match.handler import lambda_handler
        return lambda_handler(event, {})


def test_the_list_answers_with_the_missions_the_match_has_reached():
    result = _call(_player_event('GET', '/api/match/m1/missions', {'uuidMatch': 'm1'}))

    assert result['statusCode'] == 200
    missions = json.loads(result['body'])['missions']
    # mis-2 was never reached, so it is not listed at all.
    assert [m['uuid'] for m in missions] == ['mis-1']
    assert missions[0]['status'] == 'ACTIVE'
    assert missions[0]['name'] == 'Complete the Tutorial'
    assert missions[0]['stepReached'] == 1
    assert [s['done'] for s in missions[0]['steps']] == [True, False]


def test_the_status_filter_narrows_the_list():
    ok = _call(_player_event('GET', '/api/match/m1/missions', {'uuidMatch': 'm1'},
                             qs={'status': 'ACTIVE'}))
    none = _call(_player_event('GET', '/api/match/m1/missions', {'uuidMatch': 'm1'},
                               qs={'status': 'COMPLETED'}))

    assert len(json.loads(ok['body'])['missions']) == 1
    assert json.loads(none['body'])['missions'] == []


def test_detail_answers_with_one_mission_and_all_its_steps():
    result = _call(_player_event('GET', '/api/match/m1/missions/mis-1',
                                 {'uuidMatch': 'm1', 'uuidMission': 'mis-1'}))

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['uuid'] == 'mis-1'
    assert body['stepsTotal'] == 2


def test_a_mission_not_reached_reads_as_not_found():
    result = _call(_player_event('GET', '/api/match/m1/missions/mis-2',
                                 {'uuidMatch': 'm1', 'uuidMission': 'mis-2'}))

    assert result['statusCode'] == 404
    assert json.loads(result['body'])['error'] == 'MATCH_NOT_FOUND'


def test_a_match_somebody_else_owns_is_indistinguishable_from_one_that_is_gone():
    other = dict(MATCH, userCreatorUuid='someone-else')
    result = _call(_player_event('GET', '/api/match/m1/missions', {'uuidMatch': 'm1'}), other)

    assert result['statusCode'] == 404


def test_missions_ride_on_info_too_and_the_bookkeeping_row_never_leaks():
    result = _call(_player_event('GET', '/api/match/m1/info', {'uuidMatch': 'm1'}))

    body = json.loads(result['body'])
    assert [m['uuid'] for m in body['missions']] == ['mis-1']
    assert [e['key'] for e in body['registry']] == ['tutorial_progress']


def test_a_registry_write_moves_the_mission_through_the_installed_hook():
    """The hook is what makes Step 37 live: registry.upsert fires it, and it advances the
    state in place on the very match item the caller is about to persist."""
    match = {'uuid': 'm1', 'storyUuid': 's1', 'userCreatorUuid': 'player-uuid-001',
             'status': 'RUNNING', 'currentClock': 3, 'registry': []}

    with patch('match.handler.db_utils.get_item') as get_item:
        get_item.side_effect = _get_side(match)
        from match import registry as _registry

        _registry.upsert(match, 'tutorial_progress', '1')

    states = _registry.mission_states(match)
    assert [(s['idMission'], s['stringValue']) for s in states] == [(1, 'AVAILABLE')]
    # And the key that opened it is still an ordinary registry key.
    assert _registry.find(match, 'tutorial_progress') == ['1']


def test_the_cascade_is_capped_so_a_completion_event_cannot_run_away():
    from match import handler as h

    match = {'uuid': 'm1', 'storyUuid': 's1', 'status': 'RUNNING', 'registry': []}
    h._MISSION_DEPTH[0] = h._events.MAX_ENTRY_DEPTH
    try:
        h._run_missions(match)
    finally:
        h._MISSION_DEPTH[0] = 0

    assert match['registry'] == []
