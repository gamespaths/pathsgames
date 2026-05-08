"""Unit tests for ``lambda/match/handler.py`` — Step 19.

The DynamoDB layer (``common.db_utils``) and the JWT layer
(``common.jwt_utils``) are mocked so the tests run without AWS or
external state.
"""
import json
from unittest.mock import patch

import pytest

# Importing the handler eagerly so the ``@patch('match.handler....')``
# decorators below can resolve the module path at decoration time.
from match import handler as _match_handler  # noqa: F401

from helpers import make_event


def _body(result):
    return json.loads(result['body'])


PLAYER_USER = {
    'PK': 'USER#player-uuid-001',
    'SK': 'METADATA',
    'uuid': 'player-uuid-001',
    'username': 'player',
    'role': 'PLAYER',
    'state': 2,
}

BANNED_USER = {
    'PK': 'USER#banned-uuid-001',
    'SK': 'METADATA',
    'uuid': 'banned-uuid-001',
    'username': 'banned',
    'role': 'PLAYER',
    'state': 4,
}

STORY_ITEM = {
    'PK': 'STORY#story-uuid-1',
    'SK': 'METADATA',
    'uuid': 'story-uuid-1',
    'idLocationStart': 1,
    'difficulties': [
        {'uuid': 'diff-uuid-1', 'expCost': 5},
        {'uuid': 'diff-uuid-2', 'expCost': 10},
    ],
    'locations': [
        {'id': 1, 'uuid': 'loc-1', 'name': 'Hall', 'counterStart': 0},
        {'id': 2, 'uuid': 'loc-2', 'name': 'Yard', 'counterStart': 5},
    ],
    'keys': [
        {'id': 1, 'keyName': 'k1', 'keyValue': '7'},
        {'id': 2, 'keyName': 'k2', 'keyValue': 'hello'},
        {'id': 3, 'keyName': 'k3', 'keyValue': '   '},
        {'id': 4, 'keyName': 'k4', 'keyValue': None},
    ],
}


def _player_event(method, path, **kwargs):
    headers = kwargs.pop('headers', {})
    headers['Authorization'] = 'Bearer MOCK_ACCESS_player-uuid-001'
    return make_event(method, path, headers=headers, **kwargs)


# ── auth ─────────────────────────────────────────────────────────────────────

def test_create_match_no_auth_returns_401():
    from match.handler import lambda_handler
    event = make_event('POST', '/api/matches', body={'storyUuid': 's', 'difficultyUuid': 'd'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_invalid_token_returns_401(mock_jwt, mock_get):
    mock_jwt.return_value = None
    from match.handler import lambda_handler
    event = make_event('POST', '/api/matches', headers={'Authorization': 'Bearer bad'},
                       body={'storyUuid': 's', 'difficultyUuid': 'd'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_mock_user_not_in_db_returns_401(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'x', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.return_value = None
    from match.handler import lambda_handler
    event = make_event('POST', '/api/matches', headers={'Authorization': 'Bearer MOCK_ACCESS_x'},
                       body={'storyUuid': 's', 'difficultyUuid': 'd'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401


@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_jwt_user_not_in_db_uses_synthetic_user(mock_jwt, mock_get, mock_put):
    mock_jwt.return_value = {'uuid': 'jwt-uuid', 'source': 'jwt', 'role': 'PLAYER', 'username': 'j'}

    def get_side(pk, sk='METADATA'):
        if pk == 'USER#jwt-uuid':
            return None
        if pk == 'STORY#story-uuid-1':
            return STORY_ITEM
        if pk == 'SYSTEM#config':
            return None
        return None

    mock_get.side_effect = get_side
    from match.handler import lambda_handler
    event = make_event('POST', '/api/matches', headers={'Authorization': 'Bearer eyJ.x.y'},
                       body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 201, _body(result)


def test_options_preflight_short_circuit():
    from match.handler import lambda_handler
    event = make_event('OPTIONS', '/api/matches')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200


# ── create match ────────────────────────────────────────────────────────────


@pytest.fixture
def create_env():
    """Patch JWT + DynamoDB for the duration of a test. The fixture exposes
    a ``configure(...)`` helper so each test can tune the mocked story /
    user / maintenance flag."""
    with patch('match.handler.jwt_utils.verify_access_token') as mock_jwt, \
         patch('match.handler.db_utils.get_item') as mock_get, \
         patch('match.handler.db_utils.put_item') as mock_put:
        mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

        state = {'user': PLAYER_USER, 'story': None, 'maintenance': False}

        def configure(*, user=None, story=None, maintenance=False):
            if user is not None:
                state['user'] = user
            state['story'] = story
            state['maintenance'] = maintenance

        def get_side(pk, sk='METADATA'):
            if pk == 'USER#player-uuid-001':
                return state['user']
            if pk.startswith('STORY#'):
                return state['story']
            if pk == 'SYSTEM#config':
                return {'serverStatus': 'MAINTENANCE'} if state['maintenance'] else None
            return None

        mock_get.side_effect = get_side
        yield {'put': mock_put, 'configure': configure, 'jwt': mock_jwt, 'get': mock_get}


def test_create_match_invalid_input_missing_story(create_env):
    create_env['configure']()
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'difficultyUuid': 'd'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


def test_create_match_invalid_input_missing_difficulty(create_env):
    create_env['configure']()
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 's'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 400


def test_create_match_invalid_json_body(create_env):
    create_env['configure']()
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches')
    event['body'] = 'not json'
    result = lambda_handler(event, {})
    assert result['statusCode'] == 400


def test_create_match_maintenance_returns_503(create_env):
    create_env['configure'](maintenance=True)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 's', 'difficultyUuid': 'd'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 503
    assert _body(result)['error'] == 'MAINTENANCE_MODE'


def test_create_match_banned_user_returns_403(create_env):
    create_env['configure'](user=BANNED_USER, story=STORY_ITEM)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 403


def test_create_match_story_not_found_returns_404(create_env):
    create_env['configure'](story=None)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 'unknown', 'difficultyUuid': 'd'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'STORY_NOT_FOUND'


def test_create_match_difficulty_not_found_returns_404(create_env):
    create_env['configure'](story=STORY_ITEM)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'unknown'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'DIFFICULTY_NOT_FOUND'


def test_create_match_no_locations_returns_400(create_env):
    story = dict(STORY_ITEM)
    story['locations'] = []
    create_env['configure'](story=story)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'STORY_HAS_NO_LOCATIONS'


def test_create_match_happy_path(create_env):
    create_env['configure'](story=STORY_ITEM)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={
        'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1', 'name': 'My run'
    })
    result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    body = _body(result)
    assert body['status'] == 'CREATED'
    assert body['expCost'] == 5
    assert body['storyUuid'] == 'story-uuid-1'
    assert body['userCreatorUuid'] == 'player-uuid-001'

    persisted = create_env['put'].call_args.args[0]
    assert persisted['PK'].startswith('MATCH#')
    assert persisted['GSI1_PK'] == 'USER_MATCHES#player-uuid-001'
    assert len(persisted['locations']) == 2
    assert len(persisted['registry']) == 4
    assert persisted['registry'][0]['intValue'] == 7
    assert persisted['registry'][0]['stringValue'] is None
    assert persisted['registry'][1]['stringValue'] == 'hello'
    assert persisted['registry'][2]['stringValue'] == ''
    assert persisted['registry'][3]['stringValue'] is None
    assert persisted['registry'][3]['intValue'] is None


def test_create_match_no_difficulty_exp_defaults_to_5(create_env):
    story = dict(STORY_ITEM)
    story['difficulties'] = [{'uuid': 'diff-uuid-1', 'expCost': None}]
    create_env['configure'](story=story)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    persisted = create_env['put'].call_args.args[0]
    assert persisted['expCost'] == 5


def test_create_match_no_keys_seeds_empty_registry(create_env):
    story = dict(STORY_ITEM)
    story['keys'] = []
    create_env['configure'](story=story)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    persisted = create_env['put'].call_args.args[0]
    assert persisted['registry'] == []


def test_create_match_no_start_location_in_locations(create_env):
    story = dict(STORY_ITEM)
    story['idLocationStart'] = 99  # not present in locations list
    create_env['configure'](story=story)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    persisted = create_env['put'].call_args.args[0]
    assert persisted['currentLocationUuid'] is None


def test_create_match_legacy_field_names_supported(create_env):
    story = {
        'PK': 'STORY#story-uuid-1',
        'uuid': 'story-uuid-1',
        'idLocationStart': 1,
        'difficulties': [{'uuid': 'diff-uuid-1', 'expCost': 3}],
        'locations': [{'id': 1, 'uuid': 'loc-1', 'name': 'L', 'counter_time': 8}],
        'keys': [{'id': 1, 'name': 'foo', 'value': 'bar'}],
    }
    create_env['configure'](story=story)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    persisted = create_env['put'].call_args.args[0]
    assert persisted['locations'][0]['clockCounter'] == 8
    assert persisted['registry'][0]['key'] == 'foo'
    assert persisted['registry'][0]['stringValue'] == 'bar'


# ── list / info ──────────────────────────────────────────────────────────────

@patch('match.handler.db_utils.query_gsi')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_user_matches_returns_summaries(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.return_value = PLAYER_USER
    mock_query.return_value = [
        {
            'uuid': 'm1', 'storyUuid': 's', 'difficultyUuid': 'd', 'name': 'a',
            'status': 'CREATED', 'currentClock': 0, 'expCost': 5,
            'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
        },
        {
            'uuid': 'm2', 'storyUuid': 's', 'difficultyUuid': 'd', 'name': 'b',
            'status': 'CREATED', 'currentClock': 0, 'expCost': 5,
            'userCreatorUuid': 'player-uuid-001', 'tsInsert': 200,
        },
    ]
    from match.handler import lambda_handler
    event = _player_event('GET', '/api/matches')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert [m['uuid'] for m in body] == ['m2', 'm1']  # newest first


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_get_match_info_not_found(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

    def get_side(pk, sk='METADATA'):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        return None

    mock_get.side_effect = get_side
    from match.handler import lambda_handler
    event = _player_event('GET', '/api/match/missing/info', path_params={'uuidMatch': 'missing'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_get_match_info_other_owner_returns_404(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

    def get_side(pk, sk='METADATA'):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        if pk == 'MATCH#m1':
            return {'uuid': 'm1', 'userCreatorUuid': 'someone-else'}
        return None

    mock_get.side_effect = get_side
    from match.handler import lambda_handler
    event = _player_event('GET', '/api/match/m1/info', path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_get_match_info_success(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

    def get_side(pk, sk='METADATA'):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        if pk == 'MATCH#m1':
            return {
                'uuid': 'm1',
                'storyUuid': 's', 'difficultyUuid': 'd', 'name': 'name',
                'status': 'CREATED', 'currentClock': 0, 'expCost': 5,
                'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
                'currentLocationId': 1, 'currentLocationUuid': 'loc-1',
                'currentLocationName': 'Hall',
                'locations': [{'idLocation': 1, 'uuid': 'l', 'flagAlreadyActived': 0, 'clockCounter': 0}],
                'registry': [{'uuid': 'r', 'key': 'k', 'stringValue': None, 'intValue': 1}],
            }
        return None

    mock_get.side_effect = get_side
    from match.handler import lambda_handler
    event = _player_event('GET', '/api/match/m1/info', path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['match']['uuid'] == 'm1'
    assert len(body['locations']) == 1
    assert len(body['registry']) == 1
    assert body['events'] == []
    assert body['choices'] == []


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_get_match_info_missing_uuid_param_falls_back_to_path_segment(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

    def get_side(pk, sk='METADATA'):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        return None

    mock_get.side_effect = get_side
    from match.handler import lambda_handler
    event = _player_event('GET', '/api/match/abc/info')
    event['pathParameters'] = {}
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


# ── routing ──────────────────────────────────────────────────────────────────

@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_unknown_route_returns_404(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.return_value = PLAYER_USER
    from match.handler import lambda_handler
    event = _player_event('GET', '/api/something/else')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_normalize_path_handles_stage_prefix(mock_jwt, mock_get):
    """When API Gateway sends the stage in rawPath, the handler still routes."""
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.return_value = PLAYER_USER
    from match.handler import lambda_handler
    event = _player_event('GET', '/dev/api/matches')
    with patch('match.handler.db_utils.query_gsi') as mock_query:
        mock_query.return_value = []
        result = lambda_handler(event, {})
        assert result['statusCode'] == 200
