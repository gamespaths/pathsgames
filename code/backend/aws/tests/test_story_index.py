"""v0.37.5 — common/story_index.py and the readers/writers that moved to GSI2Summary."""
from unittest.mock import patch

from common import story_index
from helpers import make_event, admin_event

STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1', 'id': 3, 'idCard': 10,
    'idTextTitle': 1, 'idTextDescription': 2, 'visibility': 'PUBLIC', 'priority': 5,
    'texts': {'en': {'title': 'Map title', 'description': 'Map desc'},
              'de': {'title': 'Karte'}},
    'raw_cards': [{'id': 10, 'uuid': 'card-10', 'idTextTitle': 1}],
    'raw_texts': [
        {'idText': 1, 'lang': 'en', 'shortText': 'Raw title'},
        {'idText': 1, 'lang': 'it', 'shortText': 'Titolo'},
        {'idText': 2, 'lang': 'en', 'shortText': 'Raw desc'},
    ],
}


def test_languages_of_puts_english_first_and_dedupes():
    assert story_index.languages_of(STORY) == ['en', 'it', 'de']
    assert story_index.languages_of({}) == ['en']


def test_build_summary_map_resolves_every_language_like_the_summary_did():
    full = story_index.build_summary_map(STORY)
    assert full['meta']['id'] == 3 and full['meta']['visibility'] == 'PUBLIC'
    assert full['meta']['author'] is None
    out = full['langs']
    assert set(out) == {'en', 'it', 'de'}
    assert out['en']['title'] == 'Raw title' and out['en']['description'] == 'Raw desc'
    # Italian has a raw title but no raw description: the description falls back to English.
    assert out['it']['title'] == 'Titolo' and out['it']['description'] == 'Raw desc'
    # German has no raw rows: the raw English row wins (as _resolve_story_text always did),
    # and only a field with no raw row at all reaches the derived texts map.
    assert out['de']['title'] == 'Raw title' and out['de']['description'] == 'Raw desc'
    no_raw = {**STORY, 'raw_texts': [], 'idTextTitle': None}
    assert story_index.build_summary_map(no_raw)['langs']['de']['title'] == 'Karte'
    assert out['en']['card']['uuid'] == 'card-10' and out['it']['card']['title'] == 'Titolo'


def test_stamp_merges_the_index_attributes_in_place():
    item = dict(STORY)
    assert story_index.stamp(item) is item
    assert item['GSI2_PK'] == 'STORY_LIST' and item['GSI2_SK'] == 'STORY#s1'
    assert item['summary']['langs']['en']['title'] == 'Raw title'
    assert set(story_index.META_FIELDS) >= {'id', 'visibility', 'priority', 'category', 'group'}


def test_field_lift_and_texts_for_read_an_index_row_like_a_full_item():
    row = {'uuid': 's1', 'summary': {'meta': {'id': 7, 'visibility': 'PUBLIC'},
                                     'langs': {'en': {'title': 'T'}}}}
    assert story_index.field(row, 'id') == 7 and story_index.field(row, 'author') is None
    assert story_index.field({'id': 9, 'summary': {'meta': {'id': 7}}}, 'id') == 9
    assert story_index.texts_for(row, 'it') == {'title': 'T'}
    assert story_index.texts_for({}, 'en') == {}
    lifted = story_index.lift(dict(row))
    assert lifted['id'] == 7 and lifted['visibility'] == 'PUBLIC' 


def test_story_summary_prefers_the_stored_map_and_falls_back_to_english():
    from story.handler import _story_summary
    row = {'uuid': 's1',
           'summary': {'meta': {'id': 3, 'priority': 5, 'category': 'cat'},
                       'langs': {'en': {'title': 'T', 'description': 'D', 'card': {'uuid': 'c'}}}}}
    en = _story_summary(row, 'en')
    fr = _story_summary(row, 'fr')
    assert (en['title'], en['description'], en['card']) == ('T', 'D', {'uuid': 'c'})
    assert (en['id'], en['priority'], en['category']) == (3, 5, 'cat')
    assert fr['title'] == 'T'
    # A full item without the map still resolves from its raw rows.
    assert _story_summary(STORY, 'it')['title'] == 'Titolo'


def test_story_list_reads_gsi2summary_and_falls_back_to_gsi1_when_empty():
    from story import handler as sh
    calls = []

    def query(index, pk, sk_prefix=None):
        calls.append(index)
        return [STORY] if index == 'GSI1' else []

    with patch('story.handler.db_utils.query_gsi', side_effect=query):
        assert sh._story_list() == [STORY]
    assert calls == ['GSI2Summary', 'GSI1']

    calls.clear()
    with patch('story.handler.db_utils.query_gsi', side_effect=query), \
         patch.object(sh, '_LEGACY_INDEX_FALLBACK', False):
        assert sh._story_list() == []
    assert calls == ['GSI2Summary']

    with patch('story.handler.db_utils.query_gsi', return_value=None):
        assert sh._story_list() == []


def test_list_stories_answers_from_summary_rows():
    from story.handler import lambda_handler
    row = {'uuid': 's1',
           'summary': {'meta': {'visibility': 'PUBLIC', 'priority': 1},
                       'langs': {'en': {'title': 'T', 'description': 'D', 'card': None}}}}
    with patch('story.handler.db_utils.query_gsi', return_value=[row]):
        result = lambda_handler(make_event('GET', '/api/stories'), {})
    assert result['statusCode'] == 200
    import json
    assert json.loads(result['body'])[0]['title'] == 'T'


def test_import_writes_the_index_attributes_on_the_story():
    from story.handler import lambda_handler
    saved = []
    admin = {'PK': 'USER#admin-uuid-001', 'uuid': 'admin-uuid-001', 'role': 'ADMIN'}
    with patch('story.handler.db_utils.get_item', return_value=admin), \
         patch('story.handler.db_utils.delete_all_by_pk', return_value=0), \
         patch('story.handler.db_utils.query_gsi', return_value=[]), \
         patch('story.handler.db_utils.put_item', side_effect=saved.append), \
         patch('story.handler.story_cache.bump'):
        result = lambda_handler(admin_event('POST', '/api/admin/stories/import', body={
            'uuid': 'imp-1', 'idTextTitle': 1,
            'texts': [{'idText': 1, 'lang': 'en', 'shortText': 'Imported'}]}), {})
    assert result['statusCode'] in (200, 201), result
    story = saved[-1]
    assert story['GSI2_PK'] == 'STORY_LIST' and story['GSI2_SK'] == 'STORY#imp-1'
    assert story['summary']['langs']['en']['title'] == 'Imported'
    assert story['summary']['meta']['id'] == story['id']


def test_guest_creation_carries_both_index_keys_and_resume_falls_back():
    from auth import handler as ah
    saved = []
    with patch('auth.handler.db_utils.put_item', side_effect=saved.append), \
         patch('auth.handler.db_utils.get_item', return_value=None):
        result = ah.lambda_handler(make_event('POST', '/api/auth/guest'), {})
    assert result['statusCode'] in (200, 201), result
    guest = saved[-1]
    assert guest['GSI2_PK'] == guest['GSI1_PK'] and guest['GSI2_PK'].startswith('GUEST_TOKEN#')
    assert guest['GSI2_SK'] == 'METADATA'

    user = {'uuid': 'g1', 'username': 'guest', 'role': 'PLAYER', 'guest_token': 'tok'}
    calls = []

    def query(index, pk, sk_prefix=None):
        calls.append(index)
        return [user] if index == 'GSI1' else []

    with patch('auth.handler.db_utils.query_gsi', side_effect=query), \
         patch('auth.handler.db_utils.update_ts_last_access'):
        result = ah.lambda_handler(make_event('POST', '/api/auth/guest/resume',
                                              cookies=['pathsgames.guestcookie=tok']), {})
    assert result['statusCode'] == 200, result
    assert calls == ['GSI2Summary', 'GSI1']


def test_backfill_gsi2_summary_stamps_stories_and_guests_and_skips_the_rest():
    from unittest.mock import MagicMock
    import common.db_utils as db
    table = MagicMock()
    table.scan.return_value = {'Items': [
        {'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1', 'raw_texts': [], 'raw_cards': []},
        {'PK': 'STORY#s2', 'SK': 'METADATA', 'uuid': 's2', 'GSI2_PK': 'STORY_LIST'},
        {'PK': 'USER#g1', 'SK': 'METADATA', 'is_guest': True, 'guest_token': 'tok'},
        {'PK': 'USER#g2', 'SK': 'METADATA', 'is_guest': True},
    ]}
    with patch.object(db, '_table', table):
        stats = db.backfill_gsi2_summary(dry_run=False)
    assert stats == {'stories': 1, 'guests': 1, 'skipped': 2}
    assert table.update_item.call_count == 2
    story_call = table.update_item.call_args_list[0][1]
    assert story_call['Key'] == {'PK': 'STORY#s1', 'SK': 'METADATA'}
    assert set(story_call['ExpressionAttributeNames'].values()) == {'GSI2_PK', 'GSI2_SK', 'summary'}
    guest_call = table.update_item.call_args_list[1][1]
    assert ':v0' in guest_call['ExpressionAttributeValues']
    assert guest_call['ExpressionAttributeValues'][':v0'] == 'GUEST_TOKEN#tok'

    table.update_item.reset_mock()
    with patch.object(db, '_table', table):
        assert db.backfill_gsi2_summary(dry_run=True)['stories'] == 1
    table.update_item.assert_not_called()
