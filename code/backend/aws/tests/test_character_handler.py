"""Unit tests for the Step 21 character endpoints in ``lambda/match/handler.py``.

The DynamoDB layer (``common.db_utils``) and JWT layer (``common.jwt_utils``)
are mocked so the tests run without AWS or external state.
"""
import json
from unittest.mock import patch

from match import handler as _match_handler  # noqa: F401
from helpers import make_event


def _body(result):
    return json.loads(result['body'])


PLAYER = {'uuid': 'player-uuid-001', 'username': 'player', 'role': 'PLAYER', 'state': 2}
BANNED = {'uuid': 'player-uuid-001', 'username': 'b', 'role': 'PLAYER', 'state': 4}

STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1', 'idLocationStart': 1,
    'difficulties': [{'uuid': 'diff1', 'expCost': 5, 'life': 120, 'energy': 110, 'sad': 0,
                      'dexterity': 12, 'intelligence': 12, 'constitution': 12}],
    'characterTemplates': [
        {'uuid': 'ct-w', 'id_tipo': 1, 'lifeMax': 12, 'energyMax': 12, 'sadMax': 8,
         'dexterityStart': 3, 'intelligenceStart': 3, 'constitutionStart': 3,
         'idClassPermitted': None, 'idClassProhibited': None},
    ],
    'classes': [{'uuid': 'cl-w', 'id': 1, 'weightMax': 12, 'dexterityBase': 3,
                 'intelligenceBase': 3, 'constitutionBase': 3}],
    'classBonuses': [{'idClass': 1, 'statistic': 'life', 'value': 3},
                     {'idClass': 1, 'statistic': 'energy', 'value': 3},
                     {'idClass': 1, 'statistic': 'exp', 'value': 2}],
    'traits': [{'uuid': 'trait-1', 'id': 1, 'life': 2, 'energy': 0, 'dexterity': 0,
                'intelligence': 0, 'constitution': 1},
               {'uuid': 'trait-2', 'id': 2, 'life': 0, 'energy': 2, 'dexterity': 1,
                'intelligence': 0, 'constitution': 0}],
}


def _match(**over):
    base = {
        'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'storyUuid': 's1',
        'difficultyUuid': 'diff1', 'status': 'CREATED', 'userCreatorUuid': 'player-uuid-001',
        'characterTemplateUuid': 'ct-w', 'classUuid': 'cl-w', 'traitUuids': ['trait-1', 'trait-2'],
        'currentLocationId': 1, 'currentLocationUuid': 'loc-1', 'currentLocationName': 'Hall',
    }
    base.update(over)
    return base


def _character():
    return {'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'matchUuid': 'm1',
            'userUuid': 'player-uuid-001', 'characterTemplateUuid': 'ct-w', 'classUuid': 'cl-w',
            'dexterity': 19, 'intelligence': 18, 'constitution': 19, 'energy': 127, 'life': 137,
            'sad': 0, 'idLocation': 1, 'locationUuid': 'loc-1', 'locationName': 'Hall',
            'isSleeping': 0, 'isComa': 0, 'traitUuids': ['trait-1'], 'food': 0, 'magic': 0, 'coin': 0}


def _store(user=PLAYER, match=None, story=STORY, character=None):
    """Build a (pk, sk) -> item dispatcher for db_utils.get_item."""
    items = {('USER#player-uuid-001', 'METADATA'): {**user, 'PK': 'USER#player-uuid-001', 'SK': 'METADATA'}}
    if match is not None:
        items[('MATCH#m1', 'METADATA')] = match
    if story is not None:
        items[('STORY#s1', 'METADATA')] = story
    if character is not None:
        items[('MATCH#m1', 'CHARACTER#c1')] = character

    def _get(pk, sk='METADATA'):
        return items.get((pk, sk))
    return _get


def _event(method, path, body=None):
    return make_event(method, path, headers={'Authorization': 'Bearer MOCK_player-uuid-001'}, body=body)


def _claims():
    return {'uuid': 'player-uuid-001', 'username': 'player', 'role': 'PLAYER'}


# ── join ──────────────────────────────────────────────────────────────────────

def test_join_no_auth():
    from match.handler import lambda_handler
    result = lambda_handler(make_event('POST', '/api/matches/m1/join', body={}), {})
    assert result['statusCode'] == 401


@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_success(mock_jwt, mock_get, mock_query, mock_put):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match())
    mock_query.return_value = []
    from match.handler import lambda_handler
    result = lambda_handler(_event('POST', '/api/matches/m1/join', body={}), {})
    assert result['statusCode'] == 201
    b = _body(result)
    assert b['dexterity'] == 19
    assert b['intelligence'] == 18
    assert b['constitution'] == 19
    assert b['life'] == 137
    assert b['energy'] == 127
    assert b['idLocation'] == 1
    assert b['traitUuids'] == ['trait-1', 'trait-2']
    assert b['food'] == 0
    mock_put.assert_called_once()
    saved = mock_put.call_args[0][0]
    assert saved['SK'].startswith('CHARACTER#')
    assert saved['userUuid'] == 'player-uuid-001'


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_match_not_found(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=None)
    mock_query.return_value = []
    from match.handler import lambda_handler
    assert lambda_handler(_event('POST', '/api/matches/m1/join', body={}), {})['statusCode'] == 404


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_terminal(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(status='ENDED'))
    mock_query.return_value = []
    from match.handler import lambda_handler
    assert lambda_handler(_event('POST', '/api/matches/m1/join', body={}), {})['statusCode'] == 409


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_banned(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(user=BANNED, match=_match())
    mock_query.return_value = []
    from match.handler import lambda_handler
    assert lambda_handler(_event('POST', '/api/matches/m1/join', body={}), {})['statusCode'] == 403


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_already_joined(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match())
    mock_query.return_value = [_character()]
    from match.handler import lambda_handler
    assert lambda_handler(_event('POST', '/api/matches/m1/join', body={}), {})['statusCode'] == 409


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_template_not_found(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(characterTemplateUuid='missing'))
    mock_query.return_value = []
    from match.handler import lambda_handler
    r = lambda_handler(_event('POST', '/api/matches/m1/join', body={}), {})
    assert r['statusCode'] == 404
    assert _body(r)['error'] == 'TEMPLATE_NOT_FOUND'


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_class_not_found(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(classUuid='missing'))
    mock_query.return_value = []
    from match.handler import lambda_handler
    r = lambda_handler(_event('POST', '/api/matches/m1/join', body={}), {})
    assert r['statusCode'] == 404
    assert _body(r)['error'] == 'CLASS_NOT_FOUND'


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_class_not_compatible(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    story = json.loads(json.dumps(STORY))
    story['characterTemplates'][0]['idClassProhibited'] = 1  # class id 1 prohibited
    mock_get.side_effect = _store(match=_match(), story=story)
    mock_query.return_value = []
    from match.handler import lambda_handler
    r = lambda_handler(_event('POST', '/api/matches/m1/join', body={}), {})
    assert r['statusCode'] == 409
    assert _body(r)['error'] == 'CLASS_NOT_COMPATIBLE'


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_no_template(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(characterTemplateUuid=None))
    mock_query.return_value = []
    from match.handler import lambda_handler
    # body has no template either -> INVALID_INPUT
    r = lambda_handler(_event('POST', '/api/matches/m1/join', body={'classUuid': None}), {})
    assert r['statusCode'] == 400


# ── players ────────────────────────────────────────────────────────────────────

@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_players_ok(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match())
    mock_query.return_value = [_character()]
    from match.handler import lambda_handler
    r = lambda_handler(_event('GET', '/api/match/m1/players'), {})
    assert r['statusCode'] == 200
    assert _body(r)[0]['uuid'] == 'c1'


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_list_players_no_access(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(userCreatorUuid='someone-else'))
    mock_query.return_value = []  # no characters -> not participant
    from match.handler import lambda_handler
    assert lambda_handler(_event('GET', '/api/match/m1/players'), {})['statusCode'] == 404


# ── character detail ────────────────────────────────────────────────────────────

@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_get_character_ok(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(), character=_character())
    mock_query.return_value = [_character()]
    from match.handler import lambda_handler
    r = lambda_handler(_event('GET', '/api/match/m1/characters/c1'), {})
    assert r['statusCode'] == 200
    assert _body(r)['traitUuids'] == ['trait-1']


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_get_character_not_found(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(), character=None)
    mock_query.return_value = [_character()]
    from match.handler import lambda_handler
    r = lambda_handler(_event('GET', '/api/match/m1/characters/c1'), {})
    assert r['statusCode'] == 404


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_match_info_includes_players(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match())
    mock_query.return_value = [_character()]
    from match.handler import lambda_handler
    r = lambda_handler(_event('GET', '/api/match/m1/info'), {})
    assert r['statusCode'] == 200
    body = _body(r)
    assert len(body['players']) == 1
    assert body['players'][0]['uuid'] == 'c1'


# ── Step 23: trait selection validation ──────────────────────────────────────

def _story_with(traits=None, difficulties=None):
    story = {**STORY}
    if traits is not None:
        story['traits'] = traits
    if difficulties is not None:
        story['difficulties'] = difficulties
    return story


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_unknown_trait_not_found(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match())
    mock_query.return_value = []
    from match.handler import lambda_handler
    result = lambda_handler(_event('POST', '/api/matches/m1/join',
                                   body={'traitUuids': ['ghost']}), {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'TRAIT_NOT_FOUND'


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_duplicated_trait(mock_jwt, mock_get, mock_query):
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match())
    mock_query.return_value = []
    from match.handler import lambda_handler
    result = lambda_handler(_event('POST', '/api/matches/m1/join',
                                   body={'traitUuids': ['trait-1', 'trait-1']}), {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'TRAIT_DUPLICATED'


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_trait_not_compatible_permitted(mock_jwt, mock_get, mock_query):
    story = _story_with(traits=[
        {'uuid': 'trait-1', 'id': 1, 'costPositive': 1, 'costNegative': 0,
         'idClassPermitted': 99, 'idClassProhibited': None}])
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(), story=story)
    mock_query.return_value = []
    from match.handler import lambda_handler
    result = lambda_handler(_event('POST', '/api/matches/m1/join',
                                   body={'traitUuids': ['trait-1']}), {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'TRAIT_NOT_COMPATIBLE'


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_trait_not_compatible_prohibited(mock_jwt, mock_get, mock_query):
    story = _story_with(traits=[
        {'uuid': 'trait-1', 'id': 1, 'costPositive': 1, 'costNegative': 0,
         'idClassPermitted': None, 'idClassProhibited': 1}])  # selected class id 1
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(), story=story)
    mock_query.return_value = []
    from match.handler import lambda_handler
    result = lambda_handler(_event('POST', '/api/matches/m1/join',
                                   body={'traitUuids': ['trait-1']}), {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'TRAIT_NOT_COMPATIBLE'


@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_positive_budget_exceeded(mock_jwt, mock_get, mock_query):
    story = _story_with(
        traits=[
            {'uuid': 'trait-1', 'id': 1, 'costPositive': 1, 'costNegative': 0,
             'idClassPermitted': None, 'idClassProhibited': None},
            {'uuid': 'trait-2', 'id': 2, 'costPositive': 1, 'costNegative': 0,
             'idClassPermitted': None, 'idClassProhibited': None}],
        difficulties=[{'uuid': 'diff1', 'expCost': 5, 'traitCostPositiveBudget': 1}])
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(), story=story)
    mock_query.return_value = []
    from match.handler import lambda_handler
    result = lambda_handler(_event('POST', '/api/matches/m1/join',
                                   body={'traitUuids': ['trait-1', 'trait-2']}), {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'TRAIT_COST_EXCEEDED'


@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
@patch('match.handler.jwt_utils.verify_access_token')
def test_join_exact_budget_ok(mock_jwt, mock_get, mock_query, mock_put):
    story = _story_with(
        traits=[
            {'uuid': 'trait-1', 'id': 1, 'costPositive': 1, 'costNegative': 1,
             'idClassPermitted': None, 'idClassProhibited': None},
            {'uuid': 'trait-2', 'id': 2, 'costPositive': 1, 'costNegative': 1,
             'idClassPermitted': None, 'idClassProhibited': None}],
        difficulties=[{'uuid': 'diff1', 'expCost': 5,
                       'traitCostPositiveBudget': 2, 'traitCostNegativeBudget': 2}])
    mock_jwt.return_value = _claims()
    mock_get.side_effect = _store(match=_match(), story=story)
    mock_query.return_value = []
    from match.handler import lambda_handler
    result = lambda_handler(_event('POST', '/api/matches/m1/join',
                                   body={'traitUuids': ['trait-1', 'trait-2']}), {})
    assert result['statusCode'] == 201
    assert _body(result)['traitUuids'] == ['trait-1', 'trait-2']
