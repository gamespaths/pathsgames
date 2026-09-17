"""Step 38 — the use-exp route on the AWS backend.

The engine itself is covered by test_experience.py; what is exercised here is the routing,
the body validation, the refusal statuses, the payload shape and the persistence: the
character row, one EXP_USE LOG# row, the match logCount.
jwt_utils and db_utils are patched; no AWS calls are made.
"""
import json
from unittest.mock import patch

import pytest

from helpers import make_event, written_rows

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'guest', 'role': 'PLAYER'}
CHARACTER = {
    'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'userUuid': 'u1',
    'idLocation': 1, 'dexterity': 10, 'intelligence': 12, 'constitution': 4, 'exp': 40,
    'energy': 10, 'life': 10, 'isSleeping': 0, 'isComa': 0,
}
MATCH = {
    'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
    'currentClock': 3, 'userCreatorUuid': 'u1', 'storyUuid': 's1', 'difficultyUuid': 'd1',
    'activeCharacterUuid': 'c1', 'expCost': 99,
}
STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
    'difficulties': [{'uuid': 'd1', 'expCost': 2, 'expCostBase': 3, 'maxStatValue': 12}],
    'locations': [{'id': 1, 'uuid': 'l1', 'secureParam': 1}, {'id': 2, 'uuid': 'l2', 'secureParam': 0}],
}

_STATE = {'match': None, 'character': None}


def _get_side(pk, sk='METADATA', consistent=True):
    if pk.startswith('USER#'):
        return USER
    if pk.startswith('MATCH#'):
        return dict(_STATE['match'])
    if pk.startswith('STORY#'):
        return STORY
    return None


def _query_side(*args, **kwargs):
    return [json.loads(json.dumps(_STATE['character']))]


def _call(body=None, raw=None):
    from match.handler import lambda_handler
    event = make_event('POST', '/api/gameplay/m1/action/use-exp', body=body,
                       headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                       path_params={'uuidMatch': 'm1'})
    if raw is not None:
        event['body'] = raw
    return lambda_handler(event, {})


@pytest.fixture(autouse=True)
def _fresh_state():
    _STATE['match'] = dict(MATCH)
    _STATE['character'] = dict(CHARACTER)


def _patched(fn):
    fn = patch('match.handler.db_utils.get_item', side_effect=_get_side)(fn)
    fn = patch('match.handler.db_utils.query_sk_prefix', side_effect=_query_side)(fn)
    fn = patch('match.handler.db_utils.put_item')(fn)
    fn = patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})(fn)
    return fn


@_patched
def test_use_exp_buys_the_point_and_persists_the_character_and_one_log_row(_get, _query, _put, _jwt):
    result = _call({'stat': 'DEX'})
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['matchUuid'] == 'm1' and body['characterUuid'] == 'c1' and body['stat'] == 'dex'
    assert (body['statBefore'], body['statAfter'], body['expBefore'], body['expAfter'], body['expCost']) == (10, 11, 40, 17, 23)
    assert body['expCosts'] == {'dex': 25, 'int': None, 'cos': 11}
    assert [c['statistic'] for c in body['statChanges']] == ['dex', 'exp']

    written = written_rows().items()
    char = next(w for w in written if str(w.get('SK', '')).startswith('CHARACTER#'))
    assert char['dexterity'] == 11 and char['exp'] == 17
    logs = written_rows().logs()
    assert len(logs) == 1
    assert logs[0]['type'] == 'EXP_USE' and logs[0]['characterUuid'] == 'c1' and logs[0]['clock'] == 3
    assert logs[0]['message'] == 'EXP_USE dex 10->11 cost 23'
    match = next(w for w in written if w.get('SK') == 'METADATA')
    assert match['logCount'] == 1


@_patched
def test_use_exp_body_validation(_get, _query, _put, _jwt):
    for body in ({}, {'stat': '  '}, None):
        result = _call(body)
        assert result['statusCode'] == 400
        assert json.loads(result['body'])['error'] == 'INVALID_STAT'
    result = _call(raw='not json')
    assert result['statusCode'] == 400
    assert json.loads(result['body'])['error'] == 'INVALID_INPUT'
    result = _call({'stat': 'life'})
    assert result['statusCode'] == 400
    assert json.loads(result['body'])['error'] == 'INVALID_STAT'
    assert written_rows().logs() == []


@_patched
def test_use_exp_refusals_answer_409_with_the_engine_code(_get, _query, _put, _jwt):
    _STATE['match']['status'] = 'PAUSED'
    assert json.loads(_call({'stat': 'dex'})['body'])['error'] == 'MATCH_NOT_RUNNING'
    _STATE['match'] = dict(MATCH, activeCharacterUuid='other')
    assert json.loads(_call({'stat': 'dex'})['body'])['error'] == 'NOT_YOUR_TURN'
    _STATE['match'] = dict(MATCH)
    _STATE['character']['isComa'] = 1
    assert json.loads(_call({'stat': 'dex'})['body'])['error'] == 'COMA'
    _STATE['character'] = dict(CHARACTER, isSleeping=1)
    assert json.loads(_call({'stat': 'dex'})['body'])['error'] == 'SLEEPING'
    _STATE['character'] = dict(CHARACTER, idLocation=2)
    assert json.loads(_call({'stat': 'dex'})['body'])['error'] == 'LOCATION_NOT_SAFE'
    _STATE['character'] = dict(CHARACTER)
    result = _call({'stat': 'int'})
    assert result['statusCode'] == 409
    assert json.loads(result['body'])['error'] == 'MAX_STAT_VALUE'
    _STATE['character'] = dict(CHARACTER, exp=22)
    assert json.loads(_call({'stat': 'dex'})['body'])['error'] == 'NOT_ENOUGH_EXP'
    assert written_rows().logs() == []


def _get_side_no_match(pk, sk='METADATA', consistent=True):
    return USER if pk.startswith('USER#') else None


@patch('match.handler.db_utils.get_item', side_effect=_get_side_no_match)
@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
def test_use_exp_unknown_match_is_404(_jwt, _get):
    result = _call({'stat': 'dex'})
    assert result['statusCode'] == 404
    assert json.loads(result['body'])['error'] == 'MATCH_NOT_FOUND'
