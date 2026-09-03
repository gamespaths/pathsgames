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
        {'id': 1, 'uuid': 'loc-1', 'name': 'Hall', 'counterTime': 0},
        {'id': 2, 'uuid': 'loc-2', 'name': 'Yard', 'counterTime': 5},
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


@patch('match.handler.db_utils.query_gsi', return_value=[])
@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_jwt_user_not_in_db_uses_synthetic_user(mock_jwt, mock_get, mock_put, mock_query):
    # query_gsi is patched because the v0.32.1 duplicate-match guard reads GSI1
    # before creating: unpatched it would reach the real DynamoDB client.
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
         patch('match.handler.db_utils.query_gsi') as mock_query, \
         patch('match.handler.db_utils.put_item') as mock_put:
        mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

        # v0.32.1 — the duplicate-match guard queries GSI1; no existing match by default.
        mock_query.return_value = []

        state = {'user': PLAYER_USER, 'story': None, 'maintenance': False}

        def configure(*, user=None, story=None, maintenance=False, user_matches=None):
            if user is not None:
                state['user'] = user
            state['story'] = story
            state['maintenance'] = maintenance
            mock_query.return_value = user_matches or []

        def get_side(pk, sk='METADATA'):
            if pk == 'USER#player-uuid-001':
                return state['user']
            if pk.startswith('STORY#'):
                return state['story']
            if pk == 'SYSTEM#config':
                return {'serverStatus': 'MAINTENANCE'} if state['maintenance'] else None
            return None

        mock_get.side_effect = get_side
        yield {'put': mock_put, 'configure': configure, 'jwt': mock_jwt, 'get': mock_get,
               'query': mock_query}


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


def test_create_match_active_match_exists_returns_409(create_env):
    """v0.32.1 — a non-terminal match on the same story blocks a second one."""
    create_env['configure'](story=STORY_ITEM, user_matches=[
        {'storyUuid': 'story-uuid-1', 'status': 'RUNNING'},
    ])
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={
        'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 409
    assert _body(result)['error'] == 'ACTIVE_MATCH_ALREADY_EXISTS'
    create_env['put'].assert_not_called()


def test_create_match_paused_match_also_blocks(create_env):
    """PAUSED is suspended, not over: it keeps occupying the story slot."""
    create_env['configure'](story=STORY_ITEM, user_matches=[
        {'storyUuid': 'story-uuid-1', 'status': 'PAUSED'},
    ])
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={
        'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 409


def test_create_match_ended_or_other_story_does_not_block(create_env):
    """An ENDED match, or an active one on another story, leaves the slot free."""
    create_env['configure'](story=STORY_ITEM, user_matches=[
        {'storyUuid': 'story-uuid-1', 'status': 'ENDED'},
        {'storyUuid': 'other-story', 'status': 'RUNNING'},
    ])
    from match.handler import lambda_handler
    event = _player_event('POST', '/api/matches', body={
        'storyUuid': 'story-uuid-1', 'difficultyUuid': 'diff-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 201


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
                'locations': [{'idLocation': 1, 'uuid': 'l', 'flagAlreadyActived': 0, 'clockCounter': 0}],
                'registry': [{'uuid': 'r', 'key': 'k', 'stringValue': None, 'intValue': 1}],
            }
        if pk == 'STORY#s':
            # Step 36 — /info joins the registry with the story's key definitions, so a key
            # the story does not declare reads as hidden and is filtered out.
            return {'uuid': 's', 'keys': [{'keyName': 'k', 'keyGroup': 'tutorial',
                                           'visibility': 'PUBLIC', 'priority': 1}]}
        return None

    mock_get.side_effect = get_side
    from match.handler import lambda_handler
    event = _player_event('GET', '/api/match/m1/info', path_params={'uuidMatch': 'm1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['match']['uuid'] == 'm1'
    # v0.28.6 — locations[] is visited-only. No character has joined this CREATED
    # match, so nothing is visited yet and the list is empty (the key still exists).
    assert body['locations'] == []
    assert len(body['registry']) == 1
    assert body['events'] == []
    assert body['choices'] == []
    # the synthetic location names are gone from the contract
    assert 'currentLocationName' not in body


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
             'flagBack': 1, 'energyCost': 1, 'idCard': 3, 'idCardBack': 2,
             'card': {'title': 'STALE-NB', 'awesomeIcon': 'fa-stale'}},
        ],
        'events': [
            {'id': 1, 'uuid': 'evt-1', 'idLocation': 1, 'type': 'NORMAL', 'idCard': 4,
             'costEnery': 2, 'card': {'title': 'STALE-EVT'}},
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
    # Step 0.28.2 — orientation + dedicated return card (idCardBack 2 → 'Yard')
    assert la[0]['neighbors'][0]['idLocationFrom'] == 1
    assert la[0]['neighbors'][0]['idLocationTo'] == 2
    assert la[0]['neighbors'][0]['cardBack']['title'] == 'Yard'
    # v0.28.6 — the LOCATION card of each endpoint, gated on its own visited flag.
    # The character stands on 1 (visited); 2 was never reached (no movementLog).
    assert la[0]['neighbors'][0]['cardLocationFrom']['title'] == 'Hall'
    assert la[0]['neighbors'][0]['cardLocationTo'] is None
    # only the event specific to location 1, flagged as the end-game event
    assert [e['uuid'] for e in la[0]['events']] == ['evt-1']
    assert la[0]['events'][0]['endGame'] is True
    assert la[0]['events'][0]['card']['title'] == 'Greeting'
    # The energy the action costs, so the board renders the cost without a second call.
    assert la[0]['events'][0]['energy'] == 2


@patch('match.handler.jwt_utils.verify_access_token')
def test_match_info_hides_location_card_fallback_for_unvisited_neighbor(mock_jwt):
    # v0.28.6 fog of war: a neighbor with NO authored link card falls back to the
    # destination location's card, which must stay hidden until it is visited.
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    match_item = {
        'uuid': 'm1', 'storyUuid': 'story-uuid-1', 'difficultyUuid': 'd', 'name': 'name',
        'status': 'RUNNING', 'currentClock': 0, 'expCost': 5,
        'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
        'locations': [], 'registry': [],
        # no movement log → location 2 has never been visited
    }
    story_item = {
        'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1',
        'locations': [
            {'id': 1, 'uuid': 'loc-1', 'name': 'Hall', 'idCard': 1},
            {'id': 2, 'uuid': 'loc-2', 'name': 'Yard', 'idCard': 2},
        ],
        # neighbor 1->2 has NO idCard / idCardBack → would fall back to location 2's card
        'neighbors': [
            {'idLocationFrom': 1, 'idLocationTo': 2, 'direction': 'N',
             'flagBack': 1, 'energyCost': 1},
        ],
        'events': [],
        'raw_cards': [
            {'id': 1, 'uuid': 'card-1', 'awesomeIcon': 'fa-x', 'idTextTitle': 10},
            {'id': 2, 'uuid': 'card-2', 'awesomeIcon': 'fa-y', 'idTextTitle': 11},
        ],
        'raw_texts': [
            {'idText': 10, 'lang': 'en', 'shortText': 'Hall'},
            {'idText': 11, 'lang': 'en', 'shortText': 'Yard'},
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
    nb = _body(result)['locationsActive'][0]['neighbors'][0]
    assert nb['idLocation'] == 2
    assert nb['card'] is None       # location-card fallback hidden (unvisited)
    assert nb['cardBack'] is None


@patch('match.handler.jwt_utils.verify_access_token')
def test_match_info_one_way_neighbor_hidden_on_destination(mock_jwt):
    # Edge 1->2 is one-way (flagBack=0). The player stands on location 2 (the
    # destination), so the link back to 1 must NOT be exposed as a neighbor.
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    match_item = {
        'uuid': 'm1', 'storyUuid': 'story-uuid-1', 'difficultyUuid': 'd', 'name': 'name',
        'status': 'RUNNING', 'currentClock': 0, 'expCost': 5,
        'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
        'locations': [], 'registry': [],
    }
    story_item = {
        'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1',
        'locations': [
            {'id': 1, 'uuid': 'loc-1', 'name': 'Hall', 'idCard': 1},
            {'id': 2, 'uuid': 'loc-2', 'name': 'Yard', 'idCard': 2},
        ],
        'neighbors': [
            {'idLocationFrom': 1, 'idLocationTo': 2, 'direction': 'N',
             'flagBack': 0, 'energyCost': 1, 'idCard': 3},
        ],
        'events': [], 'raw_cards': [], 'raw_texts': [],
    }
    character = {
        'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1',
        'userUuid': 'player-uuid-001', 'idLocation': 2, 'locationName': 'Yard',
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
    la = _body(result)['locationsActive']
    assert len(la) == 1
    assert la[0]['idLocation'] == 2
    # the one-way link back to location 1 is filtered out
    assert la[0]['neighbors'] == []


@patch('match.handler.jwt_utils.verify_access_token')
def test_get_match_info_resolves_cards_in_requested_lang(mock_jwt):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

    match_item = {
        'uuid': 'm1', 'storyUuid': 'story-uuid-1', 'difficultyUuid': 'd', 'name': 'name',
        'status': 'RUNNING', 'currentClock': 0, 'expCost': 5,
        'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
        'currentLocationId': 99, 'currentLocationUuid': 'old', 'currentLocationName': 'Old',
        'locations': [], 'registry': [],
    }
    story_item = {
        'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1',
        'idEventEndGame': 1,
        'locations': [{'id': 1, 'uuid': 'loc-1', 'name': 'Hall', 'idCard': 1}],
        'neighbors': [],
        'events': [],
        'raw_cards': [{'id': 1, 'uuid': 'card-1', 'awesomeIcon': 'fa-x', 'idTextTitle': 10}],
        'raw_texts': [
            {'idText': 10, 'lang': 'en', 'shortText': 'Hall'},
            {'idText': 10, 'lang': 'it', 'shortText': 'Sala'},
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
    event = _player_event('GET', '/api/match/m1/info',
                          path_params={'uuidMatch': 'm1'}, qs={'lang': 'it'})
    with patch('match.handler.db_utils.get_item', side_effect=get_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=[character]):
        result = lambda_handler(event, {})

    assert result['statusCode'] == 200
    body = _body(result)
    assert body['locationsActive'][0]['card']['title'] == 'Sala'


@patch('match.handler.jwt_utils.verify_access_token')
def test_match_info_neighbor_cardback_reads_admin_edited_location_neighbors(mock_jwt):
    # Step 0.28.2 regression: admin CRUD edits the `locationNeighbors` array while
    # the seed/import gameplay copy lives under `neighbors`. The match handler must
    # read the admin-authoritative `locationNeighbors` so an idCardBack set in admin
    # is reflected — otherwise cardBack wrongly falls back to the forward card.
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

    match_item = {
        'uuid': 'm1', 'storyUuid': 'story-uuid-1', 'difficultyUuid': 'd', 'name': 'name',
        'status': 'RUNNING', 'currentClock': 0, 'expCost': 5,
        'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
        'currentLocationId': 99, 'currentLocationUuid': 'old', 'currentLocationName': 'Old',
        'locations': [], 'registry': [],
    }
    story_item = {
        'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1',
        'locations': [
            {'id': 1, 'uuid': 'loc-1', 'name': 'Hall', 'idCard': 1},
            {'id': 2, 'uuid': 'loc-2', 'name': 'Yard', 'idCard': 2},
        ],
        # Stale gameplay copy: NO idCardBack.
        'neighbors': [{'idLocationFrom': 1, 'idLocationTo': 2, 'direction': 'N', 'idCard': 3}],
        # Admin-edited copy: idCardBack set to card 2 (Yard).
        'locationNeighbors': [{'idLocationFrom': 1, 'idLocationTo': 2, 'direction': 'N',
                               'idCard': 3, 'idCardBack': 2}],
        'events': [],
        'raw_cards': [
            {'id': 2, 'uuid': 'card-2', 'awesomeIcon': 'fa-y', 'idTextTitle': 11},
            {'id': 3, 'uuid': 'card-3', 'awesomeIcon': 'fa-z', 'idTextTitle': 12},
        ],
        'raw_texts': [
            {'idText': 11, 'lang': 'en', 'shortText': 'Yard'},
            {'idText': 12, 'lang': 'en', 'shortText': 'To Yard'},
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
    nb = _body(result)['locationsActive'][0]['neighbors'][0]
    assert nb['card']['title'] == 'To Yard'      # forward card (idCard 3)
    assert nb['cardBack']['title'] == 'Yard'     # idCardBack 2 from locationNeighbors, NOT 'To Yard'


@patch('match.handler.jwt_utils.verify_access_token')
def test_match_info_event_placed_by_idspecificlocation_not_stale_idlocation(mock_jwt):
    # Regression: an event whose location was changed in admin carries an updated
    # idSpecificLocation but a STALE idLocation alias (set only at import). match-info
    # must place the event by idSpecificLocation (its real location B), not the alias.
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}

    match_item = {
        'uuid': 'm1', 'storyUuid': 'story-uuid-1', 'difficultyUuid': 'd', 'name': 'name',
        'status': 'RUNNING', 'currentClock': 0, 'expCost': 5,
        'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
        'currentLocationId': 2, 'currentLocationUuid': 'loc-2', 'currentLocationName': 'B',
        'locations': [], 'registry': [],
    }
    story_item = {
        'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1',
        'locations': [
            {'id': 1, 'uuid': 'loc-1', 'name': 'A', 'idCard': 1},
            {'id': 2, 'uuid': 'loc-2', 'name': 'B', 'idCard': 1},
        ],
        'neighbors': [],
        # Event moved to B in admin: idSpecificLocation=2, stale idLocation alias still 1.
        'events': [{'id': 5, 'uuid': 'evt-moved', 'type': 'NORMAL',
                    'idSpecificLocation': 2, 'idLocation': 1, 'idCard': 1}],
        'raw_cards': [{'id': 1, 'uuid': 'card-1', 'awesomeIcon': 'fa-x', 'idTextTitle': 10}],
        'raw_texts': [{'idText': 10, 'lang': 'en', 'shortText': 'Card'}],
    }
    character = {
        'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1',
        'userUuid': 'player-uuid-001', 'idLocation': 2, 'locationName': 'B',
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
    active = _body(result)['locationsActive']
    entry = next(e for e in active if e['idLocation'] == 2)
    # The event shows under B (idSpecificLocation), not lost to the stale alias.
    assert [e['uuid'] for e in entry['events']] == ['evt-moved']


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


# v0.28.1 — the admin list is now a paginated GSI2 Query (not a Scan) and
# returns a {items, nextCursor, limit} envelope with optional filters.

@patch('match.handler.db_utils.query_index_page')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_all_matches_as_admin_returns_envelope(mock_jwt, mock_get, mock_page):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    # The index already returns newest-first; the handler must not re-sort.
    mock_page.return_value = ([
        {'uuid': 'm2', 'status': 'RUNNING', 'currentClock': 0, 'expCost': 5, 'tsInsert': 200},
        {'uuid': 'm1', 'status': 'CREATED', 'currentClock': 0, 'expCost': 5, 'tsInsert': 100},
    ], None)
    from match.handler import lambda_handler
    event = make_event('GET', '/api/admin/matches',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert [m['uuid'] for m in body['items']] == ['m2', 'm1']
    assert body['nextCursor'] is None
    assert body['limit'] == 50
    # Backed by GSI2, default page size, newest-first, no filters/cursor.
    args, kwargs = mock_page.call_args
    assert args[0] == 'GSI2' and args[2] == 'MATCH'
    assert kwargs['limit'] == 50 and kwargs['ascending'] is False
    assert kwargs['start_key'] is None and kwargs['sk_from'] is None
    assert kwargs['eq_filters'] == {'status': None, 'userCreatorUuid': None, 'storyUuid': None}


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


@patch('match.handler.db_utils.query_index_page')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_all_matches_empty(mock_jwt, mock_get, mock_page):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    mock_page.return_value = ([], None)
    from match.handler import lambda_handler
    event = make_event('GET', '/api/admin/matches',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result) == {'items': [], 'nextCursor': None, 'limit': 50}


@patch('match.handler.db_utils.query_index_page')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_all_matches_emits_next_cursor(mock_jwt, mock_get, mock_page):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    last_key = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'GSI2_PK': 'MATCH', 'GSI2_SK': '00000000000000000100#m1'}
    mock_page.return_value = ([{'uuid': 'm1', 'status': 'RUNNING'}], last_key)
    from match.handler import lambda_handler, db_utils
    event = make_event('GET', '/api/admin/matches', qs={'limit': '1'},
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'})
    result = lambda_handler(event, {})
    body = _body(result)
    assert body['limit'] == 1
    assert mock_page.call_args.kwargs['limit'] == 1
    # The opaque cursor round-trips back to the LastEvaluatedKey.
    assert body['nextCursor'] is not None
    assert db_utils.decode_cursor(body['nextCursor']) == last_key


@patch('match.handler.db_utils.query_index_page', return_value=([], None))
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_all_matches_forwards_filters_and_cursor(mock_jwt, mock_get, mock_page):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    from match.handler import lambda_handler, db_utils
    cursor = db_utils.encode_cursor({'PK': 'MATCH#prev', 'SK': 'METADATA'})
    event = make_event('GET', '/api/admin/matches', headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       qs={'status': 'RUNNING', 'userUuid': 'u-9', 'storyUuid': 's-7',
                           'sinceDays': '7', 'cursor': cursor})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    kwargs = mock_page.call_args.kwargs
    assert kwargs['eq_filters'] == {'status': 'RUNNING', 'userCreatorUuid': 'u-9', 'storyUuid': 's-7'}
    assert kwargs['start_key'] == {'PK': 'MATCH#prev', 'SK': 'METADATA'}
    assert kwargs['sk_from'] is not None and len(kwargs['sk_from']) == 20  # 020d ts prefix


@patch('match.handler.db_utils.query_index_page', return_value=([], None))
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_all_matches_clamps_and_defaults_limit(mock_jwt, mock_get, mock_page):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    mock_get.return_value = ADMIN_USER
    from match.handler import lambda_handler
    for raw, expected in [('9999', 200), ('0', 1), ('-5', 1), ('abc', 50), ('', 50), ('25', 25)]:
        event = make_event('GET', '/api/admin/matches', qs={'limit': raw},
                           headers={'Authorization': 'Bearer MOCK_ACCESS_admin'})
        result = lambda_handler(event, {})
        assert _body(result)['limit'] == expected, raw
        assert mock_page.call_args.kwargs['limit'] == expected, raw


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


# ── v0.28.6 — visited-only locations[] + cardLocationFrom / cardLocationTo ──

_V287_STORY = {
    'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1',
    'locations': [
        {'id': 1, 'uuid': 'loc-1', 'name': 'Hall', 'idCard': 1},
        {'id': 2, 'uuid': 'loc-2', 'name': 'Yard', 'idCard': 2},
        {'id': 3, 'uuid': 'loc-3', 'name': 'Attic', 'idCard': 3},
    ],
    'neighbors': [
        {'idLocationFrom': 1, 'idLocationTo': 2, 'direction': 'N',
         'flagBack': 1, 'energyCost': 1},
    ],
    'events': [],
    'raw_cards': [
        {'id': 1, 'uuid': 'card-1', 'idTextTitle': 10},
        {'id': 2, 'uuid': 'card-2', 'idTextTitle': 11},
        {'id': 3, 'uuid': 'card-3', 'idTextTitle': 12},
    ],
    'raw_texts': [
        {'idText': 10, 'lang': 'en', 'shortText': 'Hall'},
        {'idText': 11, 'lang': 'en', 'shortText': 'Yard'},
        {'idText': 12, 'lang': 'en', 'shortText': 'Attic'},
    ],
}


def _v287_match(movement_log=None):
    """A match whose stored locations[] still carries the legacy `name` key, to
    prove the read path strips it even for matches created before v0.28.6."""
    return {
        'uuid': 'm1', 'storyUuid': 'story-uuid-1', 'difficultyUuid': 'd', 'name': 'name',
        'status': 'RUNNING', 'currentClock': 0, 'expCost': 5,
        'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
        'currentLocationName': 'Hall',
        'locations': [
            {'idLocation': 1, 'uuid': 'ls-1', 'flagAlreadyActived': 0, 'clockCounter': 0, 'name': 'Hall'},
            {'idLocation': 2, 'uuid': 'ls-2', 'flagAlreadyActived': 0, 'clockCounter': 0, 'name': 'Yard'},
            {'idLocation': 3, 'uuid': 'ls-3', 'flagAlreadyActived': 0, 'clockCounter': 0, 'name': 'Attic'},
        ],
        'registry': [],
        'movementLog': movement_log or [],
    }


def _v287_get_side(match_item):
    def get_side(pk, sk='METADATA'):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        if pk == 'MATCH#m1':
            return match_item
        if pk == 'STORY#story-uuid-1':
            return _V287_STORY
        return None
    return get_side


@patch('match.handler.jwt_utils.verify_access_token')
def test_match_info_locations_only_visited_and_name_stripped(mock_jwt):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    match_item = _v287_match()
    character = {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1',
                 'userUuid': 'player-uuid-001', 'idLocation': 1}

    from match.handler import lambda_handler
    event = _player_event('GET', '/api/match/m1/info', path_params={'uuidMatch': 'm1'})
    with patch('match.handler.db_utils.get_item', side_effect=_v287_get_side(match_item)), \
         patch('match.handler.db_utils.query_by_pk', return_value=[character]):
        result = lambda_handler(event, {})

    body = _body(result)
    # only location 1 is visited (the character stands there, no movement log)
    assert [l['idLocation'] for l in body['locations']] == [1]
    # the legacy persisted `name` is stripped on read, on every entry
    assert all('name' not in l for l in body['locations'])
    assert 'currentLocationName' not in body
    assert all('locationName' not in p for p in body['players'])


@patch('match.handler.jwt_utils.verify_access_token')
def test_match_info_movement_log_reveals_location_and_its_card(mock_jwt):
    mock_jwt.return_value = {'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}
    # The character moved 1 -> 2, so BOTH endpoints are visited.
    match_item = _v287_match(movement_log=[{'idLocationFrom': 1, 'idLocationTo': 2}])
    character = {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1',
                 'userUuid': 'player-uuid-001', 'idLocation': 2}

    from match.handler import lambda_handler
    event = _player_event('GET', '/api/match/m1/info', path_params={'uuidMatch': 'm1'})
    with patch('match.handler.db_utils.get_item', side_effect=_v287_get_side(match_item)), \
         patch('match.handler.db_utils.query_by_pk', return_value=[character]):
        result = lambda_handler(event, {})

    body = _body(result)
    assert sorted(l['idLocation'] for l in body['locations']) == [1, 2]  # 3 never reached
    nb = body['locationsActive'][0]['neighbors'][0]
    assert nb['cardLocationFrom']['title'] == 'Hall'
    assert nb['cardLocationTo']['title'] == 'Yard'


@patch('match.handler.jwt_utils.verify_access_token')
def test_admin_match_info_keeps_all_locations_but_same_fog(mock_jwt):
    mock_jwt.return_value = {'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'}
    match_item = _v287_match()
    character = {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1',
                 'userUuid': 'player-uuid-001', 'idLocation': 1}

    def get_side(pk, sk='METADATA'):
        if pk == 'USER#admin-uuid-001':
            return ADMIN_USER
        return _v287_get_side(match_item)(pk, sk)

    from match.handler import lambda_handler
    event = make_event('GET', '/api/admin/matches/m1/info',
                       headers={'Authorization': 'Bearer MOCK_ACCESS_admin'},
                       path_params={'uuidMatch': 'm1'})
    with patch('match.handler.db_utils.get_item', side_effect=get_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=[character]):
        result = lambda_handler(event, {})

    assert result['statusCode'] == 200
    body = _body(result)
    # the admin console needs the full gaming_state_locations table
    assert sorted(l['idLocation'] for l in body['locations']) == [1, 2, 3]
    assert all('name' not in l for l in body['locations'])
    # ...but the fog-of-war gating on the neighbor cards is unchanged
    nb = body['locationsActive'][0]['neighbors'][0]
    assert nb['cardLocationFrom']['title'] == 'Hall'
    assert nb['cardLocationTo'] is None
