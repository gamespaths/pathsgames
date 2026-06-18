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
