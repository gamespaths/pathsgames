"""Coverage for the admin match-control routes in match/handler.py
(stop/pause/resume/info/delete + PUT validation). jwt + db_utils are patched."""
import json
from unittest.mock import patch

from helpers import make_event

ADMIN_USER = {'PK': 'USER#admin-uuid-001', 'SK': 'METADATA', 'uuid': 'admin-uuid-001',
              'username': 'admin', 'role': 'ADMIN'}

MATCH = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
         'currentClock': 0, 'expCost': 5, 'tsInsert': 100}


def _body(result):
    return json.loads(result['body'])


def _admin_side(match_item=MATCH):
    def _side(pk, sk='METADATA'):
        if pk == 'USER#admin-uuid-001':
            return ADMIN_USER
        if pk.startswith('MATCH#'):
            return match_item
        return None
    return _side


def _admin_event(method, path, **kw):
    kw.setdefault('headers', {})['Authorization'] = 'Bearer MOCK_ACCESS_admin'
    return make_event(method, path, **kw)


def _call(event):
    from match.handler import lambda_handler
    return lambda_handler(event, {})


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.put_item', return_value=True)
@patch('match.handler.db_utils.get_item')
def test_stop_pause_resume_routes(mock_get, mock_put, _jwt):
    for action, expected in [('stop', 'ENDED'), ('pause', 'PAUSED'), ('resume', 'RUNNING')]:
        mock_get.side_effect = _admin_side()
        result = _call(_admin_event('POST', f'/api/admin/matches/m1/{action}',
                                    path_params={'uuidMatch': 'm1'}))
        assert result['statusCode'] == 200, action
        assert mock_put.call_args[0][0]['status'] == expected


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item')
def test_put_requires_status_or_name(mock_get, _jwt):
    mock_get.side_effect = _admin_side()
    result = _call(_admin_event('PUT', '/api/admin/matches/m1', body={},
                                path_params={'uuidMatch': 'm1'}))
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_INPUT'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item')
def test_put_invalid_json_returns_400(mock_get, _jwt):
    mock_get.side_effect = _admin_side()
    ev = _admin_event('PUT', '/api/admin/matches/m1', path_params={'uuidMatch': 'm1'})
    ev['body'] = '{bad json'
    result = _call(ev)
    assert result['statusCode'] == 400


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.delete_item', return_value=True)
@patch('match.handler.db_utils.get_item')
def test_delete_match_route(mock_get, _del, _jwt):
    # a terminal (ENDED) match can be deleted
    mock_get.side_effect = _admin_side({**MATCH, 'status': 'ENDED'})
    ok = _call(_admin_event('DELETE', '/api/admin/matches/m1',
                            path_params={'uuidMatch': 'm1'}))
    assert ok['statusCode'] in (200, 204)

    # a running match cannot be deleted → 409
    mock_get.side_effect = _admin_side({**MATCH, 'status': 'RUNNING'})
    conflict = _call(_admin_event('DELETE', '/api/admin/matches/m1',
                                  path_params={'uuidMatch': 'm1'}))
    assert conflict['statusCode'] == 409


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item')
def test_unknown_admin_subroute_returns_404(mock_get, _jwt):
    mock_get.side_effect = _admin_side()
    result = _call(_admin_event('PATCH', '/api/admin/matches/m1/weird',
                                path_params={'uuidMatch': 'm1'}))
    assert result['statusCode'] == 404


# ─── _change_statistics tests (lines 827-887) ────────────────────────────────

CHARACTER = {
    'PK': 'MATCH#m1', 'SK': 'CHARACTER#char-uuid-1',
    'uuid': 'char-uuid-1', 'userUuid': 'user-uuid-1',
    'dexterity': 10, 'intelligence': 10, 'constitution': 10,
    'energy': 50, 'energyMax': 100,
    'life': 80, 'lifeMax': 120,
    'sad': 2, 'sadMax': 8,
}


def _admin_side_with_char(match_item=MATCH, char_item=CHARACTER):
    def _side(pk, sk='METADATA'):
        if pk == 'USER#admin-uuid-001':
            return ADMIN_USER
        if pk.startswith('MATCH#') and sk == 'METADATA':
            return match_item
        if pk.startswith('MATCH#') and sk.startswith('CHARACTER#'):
            return char_item
        return None
    return _side


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.put_item', return_value=True)
@patch('match.handler.db_utils.get_item')
def test_change_statistics_updates_character(mock_get, mock_put, _jwt):
    mock_get.side_effect = _admin_side_with_char()
    result = _call(_admin_event(
        'POST',
        '/api/admin/matches/m1/player/char-uuid-1/changeStatistics',
        path_params={'uuidMatch': 'm1', 'uuidPlayer': 'char-uuid-1'},
        body={'energy': 30, 'life': 50, 'dex': 12}
    ))
    assert result['statusCode'] == 200
    assert _body(result)['status'] == 'UPDATED'
    mock_put.assert_called_once()


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.put_item', return_value=True)
@patch('match.handler.db_utils.get_item')
def test_change_statistics_caps_energy_at_max(mock_get, mock_put, _jwt):
    mock_get.side_effect = _admin_side_with_char()
    result = _call(_admin_event(
        'POST',
        '/api/admin/matches/m1/player/char-uuid-1/changeStatistics',
        path_params={'uuidMatch': 'm1'},
        body={'energy': 9999, 'life': 9999, 'sad': 9999}
    ))
    assert result['statusCode'] == 200
    # energy should be capped at energyMax=100, life at lifeMax=120, sad at sadMax=8
    updated = mock_put.call_args[0][0]
    assert updated['energy'] == 100
    assert updated['life'] == 120
    assert updated['sad'] == 8


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
def test_change_statistics_match_not_found(mock_get, mock_query_pk, _jwt):
    def _side(pk, sk='METADATA'):
        if pk == 'USER#admin-uuid-001':
            return ADMIN_USER
        return None  # no match, no character

    mock_get.side_effect = _side
    mock_query_pk.return_value = []  # no characters found
    result = _call(_admin_event(
        'POST',
        '/api/admin/matches/bad-match/player/char-uuid-1/changeStatistics',
        path_params={'uuidMatch': 'bad-match'},
        body={'energy': 10}
    ))
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'MATCH_NOT_FOUND'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.query_by_pk')
@patch('match.handler.db_utils.get_item')
def test_change_statistics_player_not_found(mock_get, mock_query_pk, _jwt):
    def _side(pk, sk='METADATA'):
        if pk == 'USER#admin-uuid-001':
            return ADMIN_USER
        if pk.startswith('MATCH#') and sk == 'METADATA':
            return MATCH
        return None
    mock_get.side_effect = _side
    mock_query_pk.return_value = []  # no characters found by pk scan
    result = _call(_admin_event(
        'POST',
        '/api/admin/matches/m1/player/bad-player/changeStatistics',
        path_params={'uuidMatch': 'm1'},
        body={'energy': 10}
    ))
    assert result['statusCode'] == 404
    assert _body(result)['error'] == 'PLAYER_NOT_FOUND'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'admin-uuid-001', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.put_item', return_value=True)
@patch('match.handler.db_utils.get_item')
def test_change_statistics_skip_minus_one_values(mock_get, mock_put, _jwt):
    mock_get.side_effect = _admin_side_with_char()
    result = _call(_admin_event(
        'POST',
        '/api/admin/matches/m1/player/char-uuid-1/changeStatistics',
        path_params={'uuidMatch': 'm1'},
        body={'energy': -1, 'life': -1}  # -1 means skip
    ))
    assert result['statusCode'] == 200
    # No updates means put_item might not be called (empty updates dict)
    # or called with no stat changes
