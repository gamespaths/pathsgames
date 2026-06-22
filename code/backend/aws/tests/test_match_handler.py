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
    # Step 23 — creator loadout traits are validated at creation
    'classes': [
        {'id': 30, 'uuid': 'cl'},
    ],
    'traits': [
        {'id': 40, 'uuid': 't1', 'costPositive': 1, 'costNegative': 0,
         'idClassPermitted': None, 'idClassProhibited': None},
        {'id': 41, 'uuid': 't2', 'costPositive': 1, 'costNegative': 0,
         'idClassPermitted': None, 'idClassProhibited': None},
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


def test_create_match_turnstile_failure_returns_400(create_env):
    create_env['configure'](story=STORY_ITEM)
    from match import handler as h
    with patch.object(h, '_TURNSTILE_SECRET', 'real-secret'), \
         patch.object(h, '_verify_turnstile', return_value=False):
        from match.handler import lambda_handler
        event = _player_event('POST', '/api/matches',
                              body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1',
                                    'turnstileToken': 'bad-token'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'TURNSTILE_VALIDATION_FAILED'


def test_verify_turnstile_bypass_token_skips_cloudflare(create_env):
    from match import handler as h
    with patch.object(h, '_TURNSTILE_SECRET', 'real-secret'), \
         patch.object(h, '_TURNSTILE_BYPASS_TOKEN', '0xROBOT'), \
         patch.object(h, '_ENV', 'test'), \
         patch('match.handler.urllib.request.urlopen') as mock_urlopen:
        assert h._verify_turnstile('0xROBOT') is True
        mock_urlopen.assert_not_called()


def test_verify_turnstile_bypass_token_mismatch_falls_through(create_env):
    from match import handler as h
    with patch.object(h, '_TURNSTILE_SECRET', 'real-secret'), \
         patch.object(h, '_TURNSTILE_BYPASS_TOKEN', '0xROBOT'), \
         patch.object(h, '_ENV', 'test'):
        assert h._verify_turnstile('something-else') is False
        assert h._verify_turnstile(None) is False


def test_verify_turnstile_empty_bypass_token_never_short_circuits(create_env):
    from match import handler as h
    with patch.object(h, '_TURNSTILE_SECRET', 'real-secret'), \
         patch.object(h, '_TURNSTILE_BYPASS_TOKEN', ''), \
         patch.object(h, '_ENV', 'test'):
        assert h._verify_turnstile('') is False
        assert h._verify_turnstile(None) is False


def test_verify_turnstile_bypass_token_disabled_in_prod(create_env):
    """Even when the bypass token is wired up, ENV=prod must refuse to skip
    Cloudflare verification — defense in depth on top of the deploy script."""
    from match import handler as h
    with patch.object(h, '_TURNSTILE_SECRET', 'real-secret'), \
         patch.object(h, '_TURNSTILE_BYPASS_TOKEN', '0xROBOT'), \
         patch.object(h, '_ENV', 'prod'), \
         patch('match.handler.urllib.request.urlopen') as mock_urlopen:
        mock_resp = mock_urlopen.return_value.__enter__.return_value
        mock_resp.read.return_value = b'{"success": false}'
        assert h._verify_turnstile('0xROBOT') is False
        mock_urlopen.assert_called_once()


def test_create_match_with_bypass_token_returns_201(create_env):
    create_env['configure'](story=STORY_ITEM)
    from match import handler as h
    with patch.object(h, '_TURNSTILE_SECRET', 'real-secret'), \
         patch.object(h, '_TURNSTILE_BYPASS_TOKEN', '0xROBOT'), \
         patch.object(h, '_ENV', 'test'):
        from match.handler import lambda_handler
        event = _player_event('POST', '/api/matches',
                              body={'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1',
                                    'turnstileToken': '0xROBOT'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    body = _body(result)
    assert body['status'] == 'CREATED'
    assert body['storyUuid'] == 'story-uuid-1'


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


def test_create_match_persists_creator_loadout(create_env):
    create_env['configure'](story=STORY_ITEM)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={
        'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1',
        'characterTemplateUuid': 'ct', 'classUuid': 'cl',
        'traitUuids': ['t1', 't2'], 'singlePlayer': 0,
    })
    result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    body = _body(result)
    assert body['singlePlayer'] == 0
    assert body['characterTemplateUuid'] == 'ct'
    assert body['classUuid'] == 'cl'
    assert body['traitUuids'] == ['t1', 't2']

    persisted = create_env['put'].call_args.args[0]
    assert persisted['singlePlayer'] == 0
    assert persisted['characterTemplateUuid'] == 'ct'
    assert persisted['classUuid'] == 'cl'
    assert persisted['traitUuids'] == ['t1', 't2']


def test_create_match_single_player_defaults_to_1(create_env):
    create_env['configure'](story=STORY_ITEM)
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={
        'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1',
    })
    result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    persisted = create_env['put'].call_args.args[0]
    assert persisted['singlePlayer'] == 1
    assert persisted['traitUuids'] == []


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


@patch('match.handler.db_utils.query_by_pk', return_value=[])
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_get_match_info_success(mock_jwt, mock_get, mock_query):
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


@patch('match.handler.jwt_utils.verify_access_token')
def test_get_match_info_locations_active(mock_jwt):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

    match_item = {
        'uuid': 'm1', 'storyUuid': 'story-uuid-1', 'difficultyUuid': 'd', 'name': 'name',
        'status': 'RUNNING', 'currentClock': 0, 'expCost': 5,
        'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
        'currentLocationId': 99, 'currentLocationUuid': 'old', 'currentLocationName': 'Old',
        'locations': [], 'registry': [],
    }
    # Each location/neighbor/event references its card via idCard. A STALE inline
    # `card` object is also present to prove the read path IGNORES it and always
    # resolves the current card from idCard against raw_cards/raw_texts.
    story_item = {
        'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1',
        'idEventEndGame': 1,
        'locations': [
            {'id': 1, 'uuid': 'loc-1', 'name': 'Hall', 'idCard': 1,
             'card': {'title': 'STALE-HALL', 'awesomeIcon': 'fa-stale'}},
            {'id': 2, 'uuid': 'loc-2', 'name': 'Yard', 'idCard': 2,
             'card': {'title': 'STALE-YARD', 'awesomeIcon': 'fa-stale'}},
        ],
        'neighbors': [
            {'idLocationFrom': 1, 'idLocationTo': 2, 'direction': 'N',
             'flagBack': 1, 'energyCost': 1, 'idCard': 3,
             'card': {'title': 'STALE-NB', 'awesomeIcon': 'fa-stale'}},
        ],
        'events': [
            {'id': 1, 'uuid': 'evt-1', 'idLocation': 1, 'type': 'NORMAL', 'idCard': 4,
             'card': {'title': 'STALE-EVT'}},
            {'id': 2, 'uuid': 'evt-2', 'idLocation': 2, 'type': 'NORMAL'},
        ],
        'raw_cards': [
            {'id': 1, 'uuid': 'card-1', 'awesomeIcon': 'fa-x', 'idTextTitle': 10},
            {'id': 2, 'uuid': 'card-2', 'awesomeIcon': 'fa-y', 'idTextTitle': 11},
            {'id': 3, 'uuid': 'card-3', 'awesomeIcon': 'fa-z', 'idTextTitle': 12},
            {'id': 4, 'uuid': 'card-4', 'idTextTitle': 13},
        ],
        'raw_texts': [
            {'idText': 10, 'lang': 'en', 'shortText': 'Hall'},
            {'idText': 11, 'lang': 'en', 'shortText': 'Yard'},
            {'idText': 12, 'lang': 'en', 'shortText': 'To Yard'},
            {'idText': 13, 'lang': 'en', 'shortText': 'Greeting'},
        ],
    }
    character = {
        'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1',
        'userUuid': 'player-uuid-001', 'idLocation': 1, 'locationName': 'Hall',
    }

    def get_side(pk, sk='METADATA'):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        if pk == 'MATCH#m1':
            return match_item
        if pk == 'STORY#story-uuid-1':
            return story_item
        return None

    from match.handler import lambda_handler
    event = _player_event('GET', '/api/match/m1/info', path_params={'uuidMatch': 'm1'})
    with patch('match.handler.db_utils.get_item', side_effect=get_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=[character]):
        result = lambda_handler(event, {})

    assert result['statusCode'] == 200
    body = _body(result)
    # current location now reflects the player's position, not the stored value
    assert body['currentLocationId'] == 1
    assert body['currentLocationUuid'] == 'loc-1'
    la = body['locationsActive']
    assert len(la) == 1
    assert la[0]['idLocation'] == 1
    assert la[0]['idCard'] == 1
    # resolved from idCard (raw_cards), NOT the stale embedded card object
    assert la[0]['card']['title'] == 'Hall'
    assert la[0]['card']['awesomeIcon'] == 'fa-x'
    assert la[0]['neighbors'][0]['idLocation'] == 2
    assert la[0]['neighbors'][0]['card']['title'] == 'To Yard'
    # only the event specific to location 1, flagged as the end-game event
    assert [e['uuid'] for e in la[0]['events']] == ['evt-1']
    assert la[0]['events'][0]['endGame'] is True
    assert la[0]['events'][0]['card']['title'] == 'Greeting'


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


# ── admin: list all matches ──────────────────────────────────────────────────

ADMIN_USER = {
    'PK': 'USER#admin-uuid-001',
    'SK': 'METADATA',
    'uuid': 'admin-uuid-001',
    'username': 'admin',
    'role': 'ADMIN',
    'state': 2,
}


@patch('match.handler.db_utils.scan_pk_prefix')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_all_matches_as_admin_returns_all(mock_jwt, mock_get, mock_scan):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    mock_scan.return_value = [
        {'uuid': 'm1', 'status': 'CREATED', 'currentClock': 0, 'expCost': 5, 'tsInsert': 100},
        {'uuid': 'm2', 'status': 'RUNNING', 'currentClock': 0, 'expCost': 5, 'tsInsert': 200},
    ]
    from match.handler import lambda_handler
    event = make_event('GET', '/api/admin/matches',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert [m['uuid'] for m in body] == ['m2', 'm1']  # newest first
    mock_scan.assert_called_once_with('MATCH#')


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_all_matches_non_admin_returns_403(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.return_value = PLAYER_USER
    from match.handler import lambda_handler
    event = make_event('GET', '/api/admin/matches',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_player'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 403


@patch('match.handler.db_utils.scan_pk_prefix')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_all_matches_empty(mock_jwt, mock_get, mock_scan):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    mock_scan.return_value = []
    from match.handler import lambda_handler
    event = make_event('GET', '/api/admin/matches',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result) == []


# ── admin match control (statuses / update / stop / delete) ───────────────────

def _admin_get_side(match_item):
    """get_item side-effect: USER# -> admin user, MATCH# -> the given item."""
    def _side(pk, sk='METADATA'):
        if pk == 'USER#admin-uuid-001':
            return ADMIN_USER
        if pk.startswith('MATCH#'):
            return match_item
        return None
    return _side


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_match_statuses(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    from match.handler import lambda_handler
    event = make_event('GET', '/api/admin/matches/statuses',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body[0] == {'value': 'CREATED', 'terminal': False}
    assert {'value': 'ENDED', 'terminal': True} in body


@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_update_match_returns_200(mock_jwt, mock_get, mock_put):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.side_effect = _admin_get_side(
        {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'CREATED'})
    from match.handler import lambda_handler
    event = make_event('PUT', '/api/admin/matches/m1',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       body={'status': 'ENDED', 'name': 'x'}, path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['status'] == 'UPDATED'
    saved = mock_put.call_args[0][0]
    assert saved['status'] == 'ENDED'
    assert saved['name'] == 'x'


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_update_match_invalid_status_returns_400(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    from match.handler import lambda_handler
    event = make_event('PUT', '/api/admin/matches/m1',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       body={'status': 'BOGUS'}, path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_STATUS'


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_update_match_empty_body_returns_400(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    from match.handler import lambda_handler
    event = make_event('PUT', '/api/admin/matches/m1',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       body={}, path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_update_match_not_found_returns_404(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.side_effect = _admin_get_side(None)
    from match.handler import lambda_handler
    event = make_event('PUT', '/api/admin/matches/m1',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       body={'name': 'x'}, path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_stop_match_sets_ended(mock_jwt, mock_get, mock_put):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.side_effect = _admin_get_side(
        {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING'})
    from match.handler import lambda_handler
    event = make_event('POST', '/api/admin/matches/m1/stop',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert mock_put.call_args[0][0]['status'] == 'ENDED'


@patch('match.handler.db_utils.delete_item')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_delete_match_terminal_returns_200(mock_jwt, mock_get, mock_del):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.side_effect = _admin_get_side(
        {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'ENDED'})
    from match.handler import lambda_handler
    event = make_event('DELETE', '/api/admin/matches/m1',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['status'] == 'DELETED'
    mock_del.assert_called_once_with('MATCH#m1', 'METADATA')


@patch('match.handler.db_utils.delete_item')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_delete_match_non_terminal_returns_409(mock_jwt, mock_get, mock_del):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.side_effect = _admin_get_side(
        {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING'})
    from match.handler import lambda_handler
    event = make_event('DELETE', '/api/admin/matches/m1',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'MATCH_NOT_STOPPED'
    mock_del.assert_not_called()


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_delete_match_not_found_returns_404(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.side_effect = _admin_get_side(None)
    from match.handler import lambda_handler
    event = make_event('DELETE', '/api/admin/matches/m1',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_admin_match_route_rejects_non_admin(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.return_value = PLAYER_USER
    from match.handler import lambda_handler
    event = make_event('DELETE', '/api/admin/matches/m1',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_player'},
                       path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 403


@patch('match.handler.db_utils.query_by_pk', return_value=[])
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_get_admin_match_info_returns_200_for_any_owner(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    # match created by another user — admin info skips the ownership check
    mock_get.side_effect = _admin_get_side(
        {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'CREATED',
         'userCreatorUuid': 'someone-else'})
    from match.handler import lambda_handler
    event = make_event('GET', '/api/admin/matches/m1/info',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['match']['uuid'] == 'm1'


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_get_admin_match_info_not_found_returns_404(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.side_effect = _admin_get_side(None)
    from match.handler import lambda_handler
    event = make_event('GET', '/api/admin/matches/m1/info',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


# ── Step 20.1 — PATCH /api/match/{uuidMatch}/end/{uuidEvent} ───────────────────

def _end_match_get_side(*, match=None, story=None):
    def _side(pk, sk='METADATA'):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        if pk.startswith('MATCH#'):
            return match
        if pk.startswith('STORY#'):
            return story
        return None
    return _side


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_end_match_unknown_match_returns_404(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.side_effect = _end_match_get_side(match=None)
    from match.handler import lambda_handler
    event = _player_event('PATCH', '/api/match/m1/end/e1',
                          path_params={'uuidMatch': 'm1', 'uuidEvent': 'e1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_end_match_other_owner_returns_404(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.side_effect = _end_match_get_side(
        match={'PK': 'MATCH#m1', 'uuid': 'm1', 'status': 'RUNNING',
               'storyUuid': 'story-uuid-1', 'userCreatorUuid': 'someone-else'})
    from match.handler import lambda_handler
    event = _player_event('PATCH', '/api/match/m1/end/e1',
                          path_params={'uuidMatch': 'm1', 'uuidEvent': 'e1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_end_match_story_missing_end_event_returns_406(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.side_effect = _end_match_get_side(
        match={'PK': 'MATCH#m1', 'uuid': 'm1', 'status': 'RUNNING',
               'storyUuid': 'story-uuid-1', 'userCreatorUuid': 'player-uuid-001'},
        story={'uuid': 'story-uuid-1', 'idEventEndGame': None, 'events': []})
    from match.handler import lambda_handler
    event = _player_event('PATCH', '/api/match/m1/end/e1',
                          path_params={'uuidMatch': 'm1', 'uuidEvent': 'e1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 406
    assert _body(result)['error'] == 'EVENT_NOT_END_GAME'


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_end_match_wrong_event_returns_406(mock_jwt, mock_get):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    mock_get.side_effect = _end_match_get_side(
        match={'PK': 'MATCH#m1', 'uuid': 'm1', 'status': 'RUNNING',
               'storyUuid': 'story-uuid-1', 'userCreatorUuid': 'player-uuid-001'},
        story={'uuid': 'story-uuid-1', 'idEventEndGame': 99,
               'events': [{'id': 1, 'uuid': 'e1'}, {'id': 99, 'uuid': 'e-end'}]})
    from match.handler import lambda_handler
    event = _player_event('PATCH', '/api/match/m1/end/e1',
                          path_params={'uuidMatch': 'm1', 'uuidEvent': 'e1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 406
    assert _body(result)['error'] == 'EVENT_NOT_END_GAME'


@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_end_match_completes_and_sets_ended(mock_jwt, mock_get, mock_put):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    match = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
             'storyUuid': 'story-uuid-1', 'userCreatorUuid': 'player-uuid-001'}
    mock_get.side_effect = _end_match_get_side(
        match=match,
        story={'uuid': 'story-uuid-1', 'idEventEndGame': 99,
               'events': [{'id': 99, 'uuid': 'e-end'}]})
    from match.handler import lambda_handler
    event = _player_event('PATCH', '/api/match/m1/end/e-end',
                          path_params={'uuidMatch': 'm1', 'uuidEvent': 'e-end'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['status'] == 'ENDED'
    assert body['uuid'] == 'm1'
    saved = mock_put.call_args[0][0]
    assert saved['status'] == 'ENDED'
    # Ensure idEventEndGame is never exposed in the response payload
    assert 'idEventEndGame' not in body
    # Response body must NOT leak the end-game event id
    assert 'idEventEndGame' not in json.dumps(body)


@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_end_match_no_auth_returns_401(mock_jwt, mock_get):
    from match.handler import lambda_handler
    event = make_event('PATCH', '/api/match/m1/end/e1',
                       path_params={'uuidMatch': 'm1', 'uuidEvent': 'e1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401
