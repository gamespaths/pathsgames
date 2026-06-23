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


# ── list_stories_by_group ─────────────────────────────────────────────────────

def test_list_stories_by_group():
    with patch('story.handler.db_utils.query_gsi', return_value=[STORY_ITEM]), \
         patch('story.handler.db_utils.get_item', return_value=None):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories/group/Group A')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200


# ── helper functions ──────────────────────────────────────────────────────────

def test_safe_int_variants():
    from story.handler import _safe_int
    assert _safe_int(5) == 5
    assert _safe_int('7') == 7
    assert _safe_int(None) == 0
    assert _safe_int('not-a-number') == 0
    assert _safe_int(None, default=3) == 3

def test_resolve_text():
    from story.handler import _resolve_text
    texts = {'en': {'title': 'Hello'}, 'it': {'title': 'Ciao'}}
    assert _resolve_text(texts, 'it', 'title') == 'Ciao'
    assert _resolve_text(texts, 'fr', 'title') == 'Hello'   # fallback to en
    assert _resolve_text(texts, 'en', 'missing') is None
    assert _resolve_text({}, 'en', 'title') is None

def test_resolve_text_per_field_english_fallback():
    """When the requested language exists but lacks this specific field (or it is
    empty), fall back to the English value for that field — not None."""
    from story.handler import _resolve_text
    # `it` has title but no description → description must fall back to English.
    texts = {'en': {'title': 'Hello', 'description': 'A tale'},
             'it': {'title': 'Ciao'}}
    assert _resolve_text(texts, 'it', 'title') == 'Ciao'
    assert _resolve_text(texts, 'it', 'description') == 'A tale'
    # Empty string is treated as missing → English fallback.
    texts_empty = {'en': {'title': 'Hello'}, 'it': {'title': ''}}
    assert _resolve_text(texts_empty, 'it', 'title') == 'Hello'

def test_resolve_story_text_prefers_raw_texts():
    """An imported story whose derived `texts` map is incomplete for `it` still
    resolves the Italian title from the flat `raw_texts` rows (like cards)."""
    from story.handler import _resolve_story_text
    item = {
        'idTextTitle': 1,
        # Derived map is missing the Italian title (only English present)…
        'texts': {'en': {'title': 'Welcome'}},
        # …but the raw Italian row IS stored on the item.
        'raw_texts': [
            {'idText': 1, 'lang': 'en', 'shortText': 'Welcome'},
            {'idText': 1, 'lang': 'it', 'shortText': 'Benvenuto'},
        ],
    }
    assert _resolve_story_text(item, 'it', 'title', 1) == 'Benvenuto'
    assert _resolve_story_text(item, 'en', 'title', 1) == 'Welcome'

def test_resolve_story_text_falls_back_to_derived_map_for_seed():
    """Seed stories carry the derived `texts` map but no top-level idTextTitle /
    raw row for it, so resolution falls back to the map (with English fallback)."""
    from story.handler import _resolve_story_text
    item = {
        'texts': {'en': {'title': 'Seed Story'}, 'it': {'title': 'Storia Seed'}},
        'raw_texts': [],
    }
    assert _resolve_story_text(item, 'it', 'title', None) == 'Storia Seed'
    assert _resolve_story_text(item, 'fr', 'title', None) == 'Seed Story'

def test_list_stories_lang_it_resolves_title_from_raw_texts():
    """End-to-end: GET /api/stories?lang=it returns the Italian title resolved
    from raw_texts even when the derived `texts` map only carries English."""
    item = {
        **STORY_ITEM,
        'idTextTitle': 1,
        'idTextDescription': 2,
        'texts': {'en': {'title': 'My Story', 'description': 'A tale'}},
        'raw_texts': [
            {'idText': 1, 'lang': 'en', 'shortText': 'My Story'},
            {'idText': 1, 'lang': 'it', 'shortText': 'La Mia Storia'},
            {'idText': 2, 'lang': 'it', 'shortText': 'Un racconto'},
        ],
    }
    with patch('story.handler.db_utils.query_gsi', return_value=[item]):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories', qs={'lang': 'it'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body[0]['title'] == 'La Mia Storia'
    assert body[0]['description'] == 'Un racconto'

def test_assign_uuids():
    from story.handler import _assign_uuids
    assert _assign_uuids([]) == []
    entities = [{'name': 'a'}, {'name': 'b', 'uuid': 'fixed'}]
    result = _assign_uuids(entities)
    assert result[0]['uuid']
    assert result[1]['uuid'] == 'fixed'

def test_assign_ids():
    from story.handler import _assign_ids
    assert _assign_ids([], 'id') == []
    entities = [{'id': 5}, {'name': 'no-id'}]
    result = _assign_ids(entities, 'id')
    assert result[0]['id'] == 5
    assert result[1]['id'] == 6   # max(5)+1

def test_build_sub_entity_texts():
    from story.handler import _build_sub_entity_texts
    raw = [
        {'idText': 1, 'lang': 'en', 'shortText': 'Name EN'},
        {'idText': 2, 'lang': 'en', 'longText': 'Desc EN'},
    ]
    result = _build_sub_entity_texts(raw, 1, 2)
    assert result['en']['name'] == 'Name EN'
    assert result['en']['description'] == 'Desc EN'

def test_normalize_entity_input_card_alias():
    from story.handler import _normalize_entity_input
    data = {'imageUrl': 'http://x/y.png'}
    result = _normalize_entity_input('cards', data)
    assert result['urlImage'] == 'http://x/y.png'
    assert 'imageUrl' not in result

def test_normalize_entity_output_creator_idcard():
    from story.handler import _normalize_entity_output
    out = _normalize_entity_output('creators', {'id_card': 9})
    assert out['idCard'] == 9


# ── import_story ──────────────────────────────────────────────────────────────

def test_import_story_requires_admin():
    from story.handler import lambda_handler
    event = make_event('POST', '/api/admin/stories/import', body={'uuid': 's1'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401

def test_import_story_empty_body():
    with patch('story.handler.db_utils.get_item', return_value=ADMIN_USER):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'EMPTY_IMPORT_DATA'

def test_import_story_invalid_json():
    with patch('story.handler.db_utils.get_item', return_value=ADMIN_USER):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import', body='{not json')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_IMPORT_DATA'

def test_import_story_id_collision():
    existing = {**STORY_ITEM, 'uuid': 'other', 'id': 7}
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]), \
         patch('story.handler.db_utils.query_gsi', return_value=[existing]):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import',
                            body={'uuid': 's-new', 'id': 7})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_IMPORT_DATA'

def test_import_story_success_full_payload():
    payload = {
        'uuid': 'imp-1',
        'idTextTitle': 1, 'idTextDescription': 2,
        'texts': [
            {'idText': 1, 'lang': 'en', 'shortText': 'Title'},
            {'idText': 2, 'lang': 'en', 'shortText': 'Desc'},
        ],
        'difficulties': [{'idTextName': 1}],
        'locations': [{'idTextName': 1}],
        'events': [{'idTextName': 1}],
        'items': [{'idTextName': 1}],
        'classes': [{'idTextName': 1}],
        'choices': [{'idText': 1}],
        'traits': [{'idTextName': 1}],
        'characterTemplates': [{'idTextName': 1}],
        'creators': [{'name': 'c'}],
        'cards': [{'urlImage': 'x'}],
        'keys': [{'name': 'k'}],
    }
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]), \
         patch('story.handler.db_utils.query_gsi', return_value=[]), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import', body=payload)
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    body = _body(result)
    assert body['status'] == 'IMPORTED'
    assert body['storyUuid'] == 'imp-1'
    assert body['textsImported'] == 2

def test_import_story_persists_character_template_class_fields():
    payload = {
        'uuid': 'imp-ct-1',
        'texts': [],
        'classes': [{'id': 1}, {'id': 5}],
        'characterTemplates': [
            {'idTextName': 1, 'id_tipo': 2,
             'idClassPermitted': 5, 'idClassProhibited': 1},
        ],
    }
    captured = {}

    def _capture(item):
        captured['item'] = item
        return True

    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]), \
         patch('story.handler.db_utils.query_gsi', return_value=[]), \
         patch('story.handler.db_utils.put_item', side_effect=_capture):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import', body=payload)
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    templates = captured['item']['characterTemplates']
    assert len(templates) == 1
    assert templates[0]['idClassPermitted'] == 5
    assert templates[0]['idClassProhibited'] == 1

def test_import_story_resolves_inline_cards_for_gameplay():
    # Step 27.x regression: imported locations/neighbors/events must carry a
    # pre-resolved `card` (and gameplay-friendly keys) so the match handler can
    # render the active location card — exactly like the seed item.
    payload = {
        'uuid': 'imp-cards-1',
        'texts': [
            {'idText': 50, 'lang': 'en', 'shortText': 'Hall'},
            {'idText': 51, 'lang': 'en', 'shortText': 'A bright hall.'},
        ],
        'cards': [{'id': 44, 'idTextName': 50, 'idTextDescription': 51,
                   'urlImage': 'hall.png', 'awesomeIcon': 'fas fa-map'}],
        'locations': [{'id': 1, 'idCard': 44}, {'id': 2, 'idCard': 44}],
        'locationNeighbors': [{'id': 1, 'idLocationFrom': 1, 'idLocationTo': 2,
                               'direction': 'EAST', 'idCard': None}],
        'events': [{'id': 1, 'idCard': 44, 'idSpecificLocation': 1, 'type': 'NORMAL'}],
    }
    captured = {}

    def _capture(item):
        captured['item'] = item
        return True

    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]), \
         patch('story.handler.db_utils.query_gsi', return_value=[]), \
         patch('story.handler.db_utils.put_item', side_effect=_capture):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import', body=payload)
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    item = captured['item']
    # Location card resolved inline
    assert item['locations'][0]['card'] is not None
    assert item['locations'][0]['card']['title'] == 'Hall'
    assert item['locations'][0]['card']['urlImage'] == 'hall.png'
    # Neighbors stored under the key the match handler reads
    assert 'neighbors' in item
    assert item['neighbors'][0]['idLocationTo'] == 2
    # Events get the gameplay `idLocation` alias + resolved card
    assert item['events'][0]['idLocation'] == 1
    assert item['events'][0]['card']['title'] == 'Hall'


def test_import_story_replaces_existing():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, STORY_ITEM]), \
         patch('story.handler.db_utils.query_gsi', return_value=[]), \
         patch('story.handler.db_utils.delete_all_by_pk', return_value=1), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import',
                            body={'uuid': 'story-uuid-1', 'texts': []})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201


# ── create_story ──────────────────────────────────────────────────────────────

def test_create_story_requires_admin():
    from story.handler import lambda_handler
    event = make_event('POST', '/api/admin/stories', body={'author': 'a'})
    result = lambda_handler(event, {})
    assert result['statusCode'] == 401

def test_create_story_invalid_json():
    with patch('story.handler.db_utils.get_item', return_value=ADMIN_USER):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories', body='{bad')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400

def test_create_story_success():
    with patch('story.handler.db_utils.get_item', return_value=ADMIN_USER), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories',
                            body={'author': 'A', 'category': 'Fantasy'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    assert 'uuid' in _body(result)

def test_create_story_empty_body_returns_400():
    with patch('story.handler.db_utils.get_item', return_value=ADMIN_USER):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories', body={})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'EMPTY_IMPORT_DATA'


# ── update_story ──────────────────────────────────────────────────────────────

def test_update_story_not_found():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]):
        from story.handler import lambda_handler
        event = admin_event('PUT', '/api/admin/stories/no-story',
                            path_params={'uuidStory': 'no-story'}, body={'author': 'x'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_update_story_invalid_json():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, STORY_ITEM]):
        from story.handler import lambda_handler
        event = admin_event('PUT', '/api/admin/stories/story-uuid-1',
                            path_params={'uuidStory': 'story-uuid-1'}, body='{bad')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400

def test_update_story_success():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, dict(STORY_ITEM)]), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('PUT', '/api/admin/stories/story-uuid-1',
                            path_params={'uuidStory': 'story-uuid-1'},
                            body={'author': 'New Author'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['status'] == 'UPDATED'


# ── list_entities ─────────────────────────────────────────────────────────────

def test_list_entities_story_not_found():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories/no/difficulties',
                            path_params={'uuidStory': 'no', 'entityType': 'difficulties'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_list_entities_unknown_type_returns_empty():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, dict(STORY_ITEM)]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories/story-uuid-1/bogus',
                            path_params={'uuidStory': 'story-uuid-1', 'entityType': 'bogus'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result) == []

def test_list_entities_success():
    story = {**STORY_ITEM, 'difficulties': [{'uuid': 'd1'}]}
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, story]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories/story-uuid-1/difficulties',
                            path_params={'uuidStory': 'story-uuid-1', 'entityType': 'difficulties'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert len(_body(result)) == 1


# ── create_entity ─────────────────────────────────────────────────────────────

def test_create_entity_story_not_found():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/no/difficulties',
                            path_params={'uuidStory': 'no', 'entityType': 'difficulties'},
                            body={'expCost': 5})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_create_entity_invalid_type():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, dict(STORY_ITEM)]):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/story-uuid-1/bogus',
                            path_params={'uuidStory': 'story-uuid-1', 'entityType': 'bogus'},
                            body={'x': 1})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400

def test_create_entity_success():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, dict(STORY_ITEM)]), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/story-uuid-1/difficulties',
                            path_params={'uuidStory': 'story-uuid-1', 'entityType': 'difficulties'},
                            body={'expCost': 5})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    assert _body(result)['id'] == 1

def test_create_entity_card_sets_idcard():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, dict(STORY_ITEM)]), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/story-uuid-1/cards',
                            path_params={'uuidStory': 'story-uuid-1', 'entityType': 'cards'},
                            body={'urlImage': 'x'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    assert _body(result)['idCard'] == 1

def test_create_entity_id_is_max_plus_one_not_len_plus_one():
    # Regression: after a middle element is deleted the list shrinks but the high
    # ids remain. The new id must be max(existing)+1, never len+1 (which collided).
    # TYPE_MAP routes 'cards' to the 'raw_cards' field.
    story = {**STORY_ITEM, 'raw_cards': [{'uuid': 'c1', 'id': 1, 'idCard': 1},
                                         {'uuid': 'c3', 'id': 3, 'idCard': 3},
                                         {'uuid': 'c5', 'id': 5, 'idCard': 5}]}
    captured = {}
    def _capture(item):
        captured['item'] = item
        return True
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, story]), \
         patch('story.handler.db_utils.put_item', side_effect=_capture):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/story-uuid-1/cards',
                            path_params={'uuidStory': 'story-uuid-1', 'entityType': 'cards'},
                            body={'urlImage': 'x'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    # len+1 would have produced 4 (collides with nothing here) — but the bug shows
    # with a list like [1,2,3,4,5] minus the middle. Here max is 5 → new id must be 6.
    assert _body(result)['id'] == 6
    assert _body(result)['idCard'] == 6
    # No duplicate ids in the persisted list.
    ids = [c['id'] for c in captured['item']['raw_cards']]
    assert len(ids) == len(set(ids)), f'duplicate ids: {ids}'


# ── get_entity ────────────────────────────────────────────────────────────────

def test_get_entity_not_found():
    story = {**STORY_ITEM, 'difficulties': [{'uuid': 'd1'}]}
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, story]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories/story-uuid-1/difficulties/missing',
                            path_params={'uuidStory': 'story-uuid-1',
                                         'entityType': 'difficulties', 'entityUuid': 'missing'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_get_entity_success():
    story = {**STORY_ITEM, 'difficulties': [{'uuid': 'd1', 'expCost': 5}]}
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, story]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories/story-uuid-1/difficulties/d1',
                            path_params={'uuidStory': 'story-uuid-1',
                                         'entityType': 'difficulties', 'entityUuid': 'd1'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['uuid'] == 'd1'


# ── update_entity ─────────────────────────────────────────────────────────────

def test_update_entity_not_found():
    story = {**STORY_ITEM, 'difficulties': [{'uuid': 'd1'}]}
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, story]):
        from story.handler import lambda_handler
        event = admin_event('PUT', '/api/admin/stories/story-uuid-1/difficulties/missing',
                            path_params={'uuidStory': 'story-uuid-1',
                                         'entityType': 'difficulties', 'entityUuid': 'missing'},
                            body={'expCost': 9})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_update_entity_success():
    story = {**STORY_ITEM, 'difficulties': [{'uuid': 'd1', 'id': 1, 'expCost': 5}]}
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, story]), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('PUT', '/api/admin/stories/story-uuid-1/difficulties/d1',
                            path_params={'uuidStory': 'story-uuid-1',
                                         'entityType': 'difficulties', 'entityUuid': 'd1'},
                            body={'expCost': 9})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['status'] == 'UPDATED'
    assert _body(result)['expCost'] == 9


# ── delete_entity ─────────────────────────────────────────────────────────────

def test_delete_entity_not_found():
    story = {**STORY_ITEM, 'difficulties': [{'uuid': 'd1'}]}
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, story]):
        from story.handler import lambda_handler
        event = admin_event('DELETE', '/api/admin/stories/story-uuid-1/difficulties/missing',
                            path_params={'uuidStory': 'story-uuid-1',
                                         'entityType': 'difficulties', 'entityUuid': 'missing'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404

def test_delete_entity_success():
    story = {**STORY_ITEM, 'difficulties': [{'uuid': 'd1'}]}
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, story]), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('DELETE', '/api/admin/stories/story-uuid-1/difficulties/d1',
                            path_params={'uuidStory': 'story-uuid-1',
                                         'entityType': 'difficulties', 'entityUuid': 'd1'})
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    assert _body(result)['status'] == 'DELETED'

def test_import_story_with_card_resolution():
    payload = {
        'uuid': 'imp-card',
        'idCard': 50,
        'idTextTitle': 1,
        'texts': [
            {'idText': 1, 'lang': 'en', 'shortText': 'Story Title'},
            {'idText': 10, 'lang': 'en', 'shortText': 'Card Title'},
            {'idText': 11, 'lang': 'en', 'shortText': 'Card Desc'},
            {'idText': 12, 'lang': 'en', 'shortText': 'Copyright'},
        ],
        'cards': [{
            'id': 50, 'cardType': 'STORY',
            'idTextName': 10, 'idTextDescription': 11, 'idTextCopyright': 12,
            'urlImage': 'http://img/card.png', 'awesomeIcon': 'fa-star',
            'styleMain': 'm', 'styleDetail': 'd',
        }],
    }
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]), \
         patch('story.handler.db_utils.query_gsi', return_value=[]), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import', body=payload)
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    assert _body(result)['storyUuid'] == 'imp-card'

def test_import_story_auto_generates_uuid_and_id():
    payload = {'texts': []}
    existing = {**STORY_ITEM, 'uuid': 'other', 'id': 3}
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]), \
         patch('story.handler.db_utils.query_gsi', return_value=[existing]), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import', body=payload)
        result = lambda_handler(event, {})
    assert result['statusCode'] == 201
    assert _body(result)['storyUuid']

def test_get_story_with_enriched_entities():
    """Covers _story_detail enrichment paths: difficulties, templates, classes,
    traits and card resolution from raw_cards/raw_texts."""
    rich = {
        **STORY_ITEM,
        'uuid': 'rich-1',
        'raw_cards': [{'id': 1, 'idTextName': 100, 'urlImage': 'http://c/1.png',
                       'cardType': 'STORY'}],
        'raw_texts': [{'idText': 100, 'lang': 'en', 'shortText': 'Card Name'}],
        'difficulties': [{'uuid': 'd1', 'id': 1, 'idCard': 1, 'expCost': 5,
                          'life': 100, 'texts': {'en': {'title': 'Easy'}}}],
        'characterTemplates': [{'uuid': 'ct1', 'id': 1, 'idCard': 1,
                                'texts': {'en': {'name': 'Hero'}}}],
        'classes': [{'uuid': 'cl1', 'id': 1, 'classBonuses': [],
                     'texts': {'en': {'name': 'Knight'}}}],
        'traits': [{'uuid': 'tr1', 'id': 1, 'texts': {'en': {'name': 'Brave'}}}],
    }
    with patch('story.handler.db_utils.get_item', return_value=rich):
        from story.handler import lambda_handler
        event = make_event('GET', '/api/stories/rich-1')
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['uuid'] == 'rich-1'
    assert len(body['difficulties']) == 1
    assert body['difficulties'][0]['life'] == 100


# ─── Step 22: story validation ──────────────────────────────────────────────

def test_import_story_invalid_reference_returns_400():
    payload = {
        'uuid': 'inv-1',
        'events': [{'id': 1}],
        'choices': [{'id': 1, 'idEvent': 99, 'otherwiseFlag': 1}],  # dangling event
    }
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]), \
         patch('story.handler.db_utils.query_gsi', return_value=[]), \
         patch('story.handler.db_utils.put_item', return_value=True):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/import', body=payload)
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    body = _body(result)
    assert body['error'] == 'INVALID_STORY'
    assert any(e['field'] == 'idEvent' for e in body['errors'])


def test_validate_story_endpoint_returns_report():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, STORY_ITEM]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories/story-uuid-1/validate')
        event['pathParameters'] = {'uuid': 'story-uuid-1'}
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200
    body = _body(result)
    assert body['valid'] is True
    assert body['count'] == 0


def test_validate_story_endpoint_not_found():
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, None]):
        from story.handler import lambda_handler
        event = admin_event('GET', '/api/admin/stories/ghost/validate')
        event['pathParameters'] = {'uuid': 'ghost'}
        result = lambda_handler(event, {})
    assert result['statusCode'] == 404


def test_create_entity_class_conflict_returns_400():
    item = dict(STORY_ITEM)
    item['id'] = 1
    item['traits'] = []
    with patch('story.handler.db_utils.get_item', side_effect=[ADMIN_USER, item]):
        from story.handler import lambda_handler
        event = admin_event('POST', '/api/admin/stories/story-uuid-1/traits',
                            body={'idClassPermitted': 3, 'idClassProhibited': 3})
        event['pathParameters'] = {'uuidStory': 'story-uuid-1', 'entityType': 'traits'}
        result = lambda_handler(event, {})
    assert result['statusCode'] == 400
    assert _body(result)['error'] == 'INVALID_STORY'


# ── Step 23: trait listing filtered by class ──────────────────────────────────

def _step23_story():
    return {
        'PK': 'STORY#s23', 'SK': 'METADATA', 'uuid': 's23', 'visibility': 'PUBLIC',
        'classes': [{'uuid': 'cl-1', 'id': 30}],
        'traits': [
            {'uuid': 'tr-unrestricted', 'id': 1, 'costPositive': 1, 'costNegative': 0,
             'idClassPermitted': None, 'idClassProhibited': None, 'texts': {}},
            {'uuid': 'tr-permitted-match', 'id': 2, 'costPositive': 1, 'costNegative': 0,
             'idClassPermitted': 30, 'idClassProhibited': None, 'texts': {}},
            {'uuid': 'tr-permitted-other', 'id': 3, 'costPositive': 1, 'costNegative': 0,
             'idClassPermitted': 99, 'idClassProhibited': None, 'texts': {}},
            {'uuid': 'tr-prohibited-match', 'id': 4, 'costPositive': 1, 'costNegative': 0,
             'idClassPermitted': None, 'idClassProhibited': 30, 'texts': {}},
            {'uuid': 'tr-prohibited-other', 'id': 5, 'costPositive': 1, 'costNegative': 0,
             'idClassPermitted': None, 'idClassProhibited': 99, 'texts': {}},
        ],
    }


@patch('story.handler.db_utils.get_item')
def test_list_traits_for_class_filters(mock_get):
    mock_get.return_value = _step23_story()
    from story.handler import lambda_handler
    result = lambda_handler(make_event('GET', '/api/stories/s23/classes/cl-1/traits'), {})
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert [t['uuid'] for t in body] == ['tr-unrestricted', 'tr-permitted-match', 'tr-prohibited-other']
    assert body[0]['costPositive'] == 1


@patch('story.handler.db_utils.get_item')
def test_list_traits_for_class_story_not_found(mock_get):
    mock_get.return_value = None
    from story.handler import lambda_handler
    result = lambda_handler(make_event('GET', '/api/stories/ghost/classes/cl-1/traits'), {})
    assert result['statusCode'] == 404
    assert json.loads(result['body'])['error'] == 'STORY_NOT_FOUND'


@patch('story.handler.db_utils.get_item')
def test_list_traits_for_class_class_not_found(mock_get):
    mock_get.return_value = _step23_story()
    from story.handler import lambda_handler
    result = lambda_handler(make_event('GET', '/api/stories/s23/classes/ghost/traits'), {})
    assert result['statusCode'] == 404
    assert json.loads(result['body'])['error'] == 'CLASS_NOT_FOUND'
