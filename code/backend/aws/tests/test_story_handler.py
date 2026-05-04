"""
Unit tests for story/handler.py — db_utils and jwt_utils mocked.
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from helpers import make_event, admin_event


def _body(result):
    return json.loads(result['body'])


STORY_ITEM = {
    'PK': 'STORY#story-uuid-1',
    'SK': 'METADATA',
    'uuid': 'story-uuid-1',
    'GSI1_PK': 'STORY_LIST',
    'GSI1_SK': 'STORY#story-uuid-1',
    'visibility': 'PUBLIC',
    'author': 'Test Author',
    'category': 'Fantasy',
    'group': 'Group A',
    'priority': 10,
    'peghi': 0,
    'texts': {'en': {'title': 'My Story', 'description': 'A tale'}},
    'difficulties': [],
    'characterTemplates': [],
    'classes': [],
    'traits': [],
    'card': None,
}

ADMIN_USER = {
    'PK': 'USER#admin-uuid-001',
    'SK': 'METADATA',
    'uuid': 'admin-uuid-001',
    'username': 'admin',
    'role': 'ADMIN',
}

PLAYER_USER = {
    'PK': 'USER#player-uuid-002',
    'SK': 'METADATA',
    'uuid': 'player-uuid-002',
    'username': 'player',
    'role': 'PLAYER',
}


# ── routing ───────────────────────────────────────────────────────────────────

def test_unknown_route_returns_404():
    from story.handler import lambda_handler
    event = make_event('GET', '/api/stories/no/match/here')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 404


# ── list_stories ──────────────────────────────────────────────────────────────

def test_list_stories_returns_200():
    with patch('story.handler.db_utils.query_gsi', return_value=[STORY_ITEM]), \
         patch('story.handler.db_utils.get_item', return_value=None):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert isinstance(body, list)

def test_list_stories_empty():
    with patch('story.handler.db_utils.query_gsi', return_value=[]):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result) == []


# ── list_categories ───────────────────────────────────────────────────────────

def test_list_categories_returns_200():
    items = [
        {**STORY_ITEM, 'category': 'Fantasy'},
        {**STORY_ITEM, 'uuid': 's2', 'category': 'Sci-Fi'},
    ]
    with patch('story.handler.db_utils.query_gsi', return_value=items):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories/categories')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    categories = _body(result)
    assert 'Fantasy' in categories
    assert 'Sci-Fi' in categories


# ── list_groups ───────────────────────────────────────────────────────────────

def test_list_groups_returns_200():
    with patch('story.handler.db_utils.query_gsi', return_value=[STORY_ITEM]):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories/groups')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert 'Group A' in _body(result)


# ── get_story ─────────────────────────────────────────────────────────────────

def test_get_story_found_returns_200():
    with patch('story.handler.db_utils.get_item', return_value=STORY_ITEM):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories/story-uuid-1')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['uuid'] == 'story-uuid-1'

def test_get_story_not_found_returns_404():
    with patch('story.handler.db_utils.get_item', return_value=None):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories/no-such-story')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404


# ── list_stories_by_category ──────────────────────────────────────────────────

def test_list_stories_by_category():
    with patch('story.handler.db_utils.query_gsi', return_value=[STORY_ITEM]), \
         patch('story.handler.db_utils.get_item', return_value=None):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories/category/Fantasy')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200


# ── admin: list_all_stories ───────────────────────────────────────────────────

def test_admin_list_stories_requires_auth():
    from story.handler import lambda_handler
    event = make_event('GET', '/api/admin/stories')
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401

def test_admin_list_stories_player_forbidden():
    with patch('story.handler.db_utils.get_item', return_value=PLAYER_USER):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/admin/stories',
                           headers={'Authorization': 'Bearer MOCK_ACCESS_player-uuid-002'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 403

def test_admin_list_stories_admin_returns_200():
    with patch('story.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('story.handler.db_utils.query_gsi', return_value=[STORY_ITEM]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200


# ── admin: delete_story ───────────────────────────────────────────────────────

def test_delete_story_requires_admin():
    from story.handler import lambda_handler
    event = make_event('DELETE', '/api/admin/stories/story-uuid-1',
                       path_params={'uuid': 'story-uuid-1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401

def test_delete_story_not_found_returns_404():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]):
        from story.handler import lambda_handler
        event = admin_event('DELETE', '/api/admin/stories/no-such-story',
                            path_params={'uuid': 'no-such-story'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_delete_story_success_returns_200():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, STORY_ITEM]), \
         patch('story.handler.db_utils.delete_all_by_pk', return_value=1):
        from story.handler import lambda_handler
        event = admin_event('DELETE', '/api/admin/stories/story-uuid-1',
                            path_params={'uuid': 'story-uuid-1'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['uuid'] == 'story-uuid-1'


# ── admin: get_admin_story ────────────────────────────────────────────────────

def test_get_admin_story_found():
    # get_item called 3 times: auth user, story, card (None = no card)
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, STORY_ITEM, None]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories/story-uuid-1',
                            path_params={'uuid': 'story-uuid-1'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200

def test_get_admin_story_not_found_returns_404():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories/no-story',
                            path_params={'uuid': 'no-story'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404
