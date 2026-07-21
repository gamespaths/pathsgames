"""Coverage for the router's path-parameter fallback branches in match/handler.py.

API Gateway does not always expose ``pathParameters``; every route therefore has a
``segments = path.split('/')`` fallback. These tests drive each route with an event
that carries NO pathParameters, so the fallback branch is the one that runs.
jwt_utils + db_utils are patched; the match lookup returns None so each call ends in
a cheap 404 *after* the fallback code has executed.
"""
import json
from unittest.mock import patch

from helpers import make_event

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'p1',
        'role': 'PLAYER', 'state': 1}
ADMIN = {'PK': 'USER#a1', 'SK': 'METADATA', 'uuid': 'a1', 'username': 'admin',
         'role': 'ADMIN', 'state': 1}


def _call(event):
    from match.handler import lambda_handler
    return lambda_handler(event, {})


def _player_event(method, path, **kw):
    kw.setdefault('headers', {})['Authorization'] = 'Bearer MOCK_ACCESS_u1'
    return make_event(method, path, **kw)


def _get_side(user):
    def _side(pk, sk='METADATA'):
        if pk == f"USER#{user['uuid']}":
            return user
        return None
    return _side


# ── player routes: no pathParameters → segment fallback ──────────────────────

PLAYER_ROUTES = [
    ('GET',   '/api/matches/mX/weather'),
    ('GET',   '/api/matches/mX/logs'),
    ('GET',   '/api/match/mX/info'),
    ('PATCH', '/api/match/mX/end/e1'),
    ('POST',  '/api/matches/mX/join'),
    ('GET',   '/api/match/mX/players'),
    ('GET',   '/api/match/mX/characters/c1'),
    ('POST',  '/api/matches/mX/start'),
    ('POST',  '/api/gameplay/mX/action/pass'),
    ('GET',   '/api/match/mX/turn-sequence'),
    ('POST',  '/api/gameplay/mX/action/sleep'),
    ('GET',   '/api/match/mX/clock'),
    ('POST',  '/api/gameplay/mX/movements/start'),
    ('POST',  '/api/gameplay/mX/action/execute-event'),
    ('GET',   '/api/match/mX/locations'),
]


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.get_item')
def test_player_routes_resolve_uuid_from_path_segments(mock_get, _jwt):
    for method, path in PLAYER_ROUTES:
        mock_get.side_effect = _get_side(USER)
        body = {} if method in ('POST', 'PATCH') else None
        result = _call(_player_event(method, path, body=body))
        # The match does not exist → 4xx, but only *after* the fallback ran.
        assert result['statusCode'] in (400, 403, 404), f'{method} {path}'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.get_item')
def test_body_routes_reject_invalid_json(mock_get, _jwt):
    """Every route that parses a JSON body must answer 400 on malformed input."""
    body_routes = [
        ('POST', '/api/matches/mX/join'),
        ('POST', '/api/gameplay/mX/movements/start'),
        ('POST', '/api/gameplay/mX/action/execute-event'),
        ('POST', '/api/matches'),
    ]
    for method, path in body_routes:
        mock_get.side_effect = _get_side(USER)
        ev = _player_event(method, path)
        ev['body'] = '{not json'
        result = _call(ev)
        assert result['statusCode'] == 400, f'{method} {path}'
        assert json.loads(result['body'])['error'] == 'INVALID_INPUT'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.get_item')
def test_unknown_route_is_404(mock_get, _jwt):
    mock_get.side_effect = _get_side(USER)
    result = _call(_player_event('GET', '/api/match/mX/nonexistent-thing'))
    assert result['statusCode'] == 404
    assert json.loads(result['body'])['error'] == 'NOT_FOUND'


# ── admin routes: no pathParameters → segments[4] fallback ───────────────────

ADMIN_ROUTES = [
    ('GET',  '/api/admin/matches/mX/info'),
    ('GET',  '/api/admin/matches/mX/weather'),
    ('GET',  '/api/admin/matches/mX/logs'),
    ('GET',  '/api/admin/matches/mX/locations'),
    ('POST', '/api/admin/matches/mX/stop'),
    ('POST', '/api/admin/matches/mX/pause'),
    ('POST', '/api/admin/matches/mX/resume'),
    ('DELETE', '/api/admin/matches/mX'),
]


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'a1', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item')
def test_admin_routes_resolve_uuid_from_path_segments(mock_get, _jwt):
    for method, path in ADMIN_ROUTES:
        mock_get.side_effect = _get_side(ADMIN)
        result = _call(make_event(method, path,
                                  headers={'Authorization': 'Bearer MOCK_ACCESS_a1'}))
        assert result['statusCode'] == 404, f'{method} {path}'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'a1', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item')
def test_admin_change_statistics_route(mock_get, _jwt):
    mock_get.side_effect = _get_side(ADMIN)
    path = '/api/admin/matches/mX/player/pY/changeStatistics'
    ev = make_event('POST', path, headers={'Authorization': 'Bearer MOCK_ACCESS_a1'})
    ev['body'] = '{broken'
    result = _call(ev)
    assert result['statusCode'] == 400
    assert json.loads(result['body'])['error'] == 'INVALID_INPUT'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'a1', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item')
def test_admin_change_statistics_uuid_from_segments(mock_get, _jwt):
    mock_get.side_effect = _get_side(ADMIN)
    path = '/api/admin/matches/mX/player/pY/changeStatistics'
    result = _call(make_event('POST', path, body={'statistic': 'energy', 'value': 1},
                              headers={'Authorization': 'Bearer MOCK_ACCESS_a1'}))
    assert result['statusCode'] == 404


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'a1', 'source': 'mock', 'role': 'ADMIN'})
@patch('match.handler.db_utils.get_item')
def test_admin_unknown_subroute_is_404(mock_get, _jwt):
    mock_get.side_effect = _get_side(ADMIN)
    result = _call(make_event('PATCH', '/api/admin/matches/mX/whatever',
                              headers={'Authorization': 'Bearer MOCK_ACCESS_a1'}))
    assert result['statusCode'] == 404


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.get_item')
def test_admin_route_forbidden_for_player(mock_get, _jwt):
    mock_get.side_effect = _get_side(USER)
    result = _call(_player_event('GET', '/api/admin/matches'))
    assert result['statusCode'] == 403


def test_options_preflight_short_circuits():
    result = _call(make_event('OPTIONS', '/api/matches'))
    assert result['statusCode'] == 200
