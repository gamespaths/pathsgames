"""Step 36 — GET /api/match/{uuidMatch}/registry on the AWS backend."""
import json
from unittest.mock import patch

from helpers import make_event

PLAYER_USER = {'uuid': 'player-uuid-001', 'role': 'PLAYER', 'status': 'ACTIVE'}

MATCH = {
    'uuid': 'm1', 'storyUuid': 's1', 'userCreatorUuid': 'player-uuid-001',
    'registry': [
        {'uuid': 'r-1', 'key': 'tutorial_progress', 'stringValue': None, 'intValue': 3,
         'idCharacter': 12},
        {'uuid': 'r-2', 'key': 'secret_door', 'stringValue': 'OPEN', 'intValue': None},
    ],
}
STORY = {
    'uuid': 's1',
    'keys': [
        {'keyName': 'tutorial_progress', 'keyGroup': 'tutorial', 'visibility': 'PUBLIC',
         'priority': 1, 'idCard': 950},
        {'keyName': 'secret_door', 'keyGroup': 'secrets', 'visibility': 'HIDDEN',
         'priority': 1},
    ],
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


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'})
def test_returns_visible_keys_grouped_by_category(_jwt, mock_get):
    mock_get.side_effect = _get_side()
    from match.handler import lambda_handler

    result = lambda_handler(
        _player_event('GET', '/api/match/m1/registry', {'uuidMatch': 'm1'}), {})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert len(body['groups']) == 1
    group = body['groups'][0]
    assert group['category'] == 'tutorial'
    entry = group['entries'][0]
    assert entry['key'] == 'tutorial_progress'
    assert entry['intValue'] == 3 and entry['stringValue'] is None
    assert entry['visible'] is True and entry['priority'] == 1
    assert entry['idCharacter'] == 12 and entry['idCard'] == 950


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'})
def test_include_hidden_reveals_the_keys_the_story_hid(_jwt, mock_get):
    mock_get.side_effect = _get_side()
    from match.handler import lambda_handler

    result = lambda_handler(
        _player_event('GET', '/api/match/m1/registry', {'uuidMatch': 'm1'},
                      qs={'includeHidden': 'true'}), {})

    body = json.loads(result['body'])
    assert [g['category'] for g in body['groups']] == ['secrets', 'tutorial']


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'})
def test_an_empty_registry_is_an_empty_array(_jwt, mock_get):
    mock_get.side_effect = _get_side(match={'uuid': 'm1', 'storyUuid': 's1',
                                            'userCreatorUuid': 'player-uuid-001'})
    from match.handler import lambda_handler

    result = lambda_handler(
        _player_event('GET', '/api/match/m1/registry', {'uuidMatch': 'm1'}), {})

    assert result['statusCode'] == 200
    assert json.loads(result['body']) == {'groups': []}


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'})
def test_a_match_the_caller_does_not_own_reads_as_not_found(_jwt, mock_get):
    mock_get.side_effect = _get_side(match={'uuid': 'm1', 'userCreatorUuid': 'someone-else'})
    from match.handler import lambda_handler

    result = lambda_handler(
        _player_event('GET', '/api/match/m1/registry', {'uuidMatch': 'm1'}), {})

    assert result['statusCode'] == 404


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'})
def test_the_uuid_falls_back_to_the_path_segment(_jwt, mock_get):
    """API Gateway does not always populate pathParameters."""
    mock_get.side_effect = _get_side()
    from match.handler import lambda_handler

    result = lambda_handler(_player_event('GET', '/api/match/m1/registry'), {})

    assert result['statusCode'] == 200


@patch('match.handler.db_utils.query_by_pk', return_value=[])
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'})
def test_info_carries_the_same_joined_entries_as_the_endpoint(_jwt, mock_get, _query):
    """The duplication is the point: the board reads /info and must see what /registry says.

    This is the regression that shipped broken once — /info passed the raw embedded rows
    through, so it carried no `visible` flag and the two payloads disagreed.
    """
    mock_get.side_effect = _get_side()
    from match.handler import lambda_handler

    info = json.loads(lambda_handler(
        _player_event('GET', '/api/match/m1/info', {'uuidMatch': 'm1'}), {})['body'])
    registry = json.loads(lambda_handler(
        _player_event('GET', '/api/match/m1/registry', {'uuidMatch': 'm1'}), {})['body'])

    from_endpoint = sorted((e['key'], e['intValue'], e['stringValue'])
                           for g in registry['groups'] for e in g['entries'])
    from_info = sorted((e['key'], e['intValue'], e['stringValue'])
                       for e in info['registry'] if e['visible'])
    assert from_info == from_endpoint
    # And the hidden key is on neither: /info has no includeHidden door at all.
    assert 'secret_door' not in [e['key'] for e in info['registry']]
