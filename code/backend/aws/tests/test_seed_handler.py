"""
Unit tests for the dev-only test-data cleanup route in seed/handler.py
(POST /api/dev/cleanup). db_utils functions are patched so no real DynamoDB
calls are made.
"""
import json
import os
from unittest.mock import patch
from helpers import make_event


def test_cleanup_returns_403_when_not_dev():
    from seed.handler import lambda_handler
    with patch.dict(os.environ, {'ENV': 'prod'}):
        result = lambda_handler(make_event('POST', '/api/dev/cleanup'), {})
    assert result['statusCode'] == 403


def test_cleanup_deletes_only_robot_data_and_seed_stories():
    """Safety test: cleanup must remove ONLY the robot-test rows (marker
    'robottest') plus the seed stories — never the real ("good") data.
    """
    guests = [
        {'PK': 'USER#real-1', 'SK': 'METADATA', 'username': 'guest_real0001', 'is_guest': True},
        {'PK': 'USER#rob-1', 'SK': 'METADATA', 'username': 'robottest_aaaa1111', 'is_guest': True},
        {'PK': 'USER#rob-2', 'SK': 'METADATA', 'username': 'robottest_bbbb2222', 'is_guest': True},
    ]
    matches = [
        {'PK': 'MATCH#real-m', 'SK': 'METADATA', 'name': 'My epic adventure'},
        {'PK': 'MATCH#rob-m', 'SK': 'METADATA', 'name': 'robottest_match'},
    ]
    deleted = []
    story_pks = []
    from seed.handler import lambda_handler, SEED_STORIES
    with patch('seed.handler.db_utils.scan_filter', return_value=guests), \
         patch('seed.handler.db_utils.scan_pk_prefix', return_value=matches), \
         patch('seed.handler.db_utils.delete_item',
               side_effect=lambda pk, sk='METADATA': deleted.append(pk)), \
         patch('seed.handler.db_utils.delete_all_by_pk',
               side_effect=lambda pk: (story_pks.append(pk), 1)[1]), \
         patch.dict(os.environ, {'ENV': 'dev'}):
        result = lambda_handler(make_event('POST', '/api/dev/cleanup'), {})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body == {
        'deletedGuests': 2,
        'deletedMatches': 1,
        'deletedStories': len(SEED_STORIES),
    }
    # the real ("good") rows must NOT be deleted
    assert 'USER#real-1' not in deleted
    assert 'MATCH#real-m' not in deleted
    assert sorted(deleted) == ['MATCH#rob-m', 'USER#rob-1', 'USER#rob-2']
    # every seed story was targeted for deletion by its STORY#{uuid} PK
    assert story_pks == [f"STORY#{s['uuid']}" for s in SEED_STORIES]


def test_cleanup_with_no_robot_data_returns_zero():
    guests = [{'PK': 'USER#real-1', 'SK': 'METADATA', 'username': 'guest_real0001', 'is_guest': True}]
    matches = [{'PK': 'MATCH#real-m', 'SK': 'METADATA', 'name': 'Real match'}]
    deleted = []
    from seed.handler import lambda_handler
    with patch('seed.handler.db_utils.scan_filter', return_value=guests), \
         patch('seed.handler.db_utils.scan_pk_prefix', return_value=matches), \
         patch('seed.handler.db_utils.delete_item',
               side_effect=lambda pk, sk='METADATA': deleted.append(pk)), \
         patch('seed.handler.db_utils.delete_all_by_pk', return_value=0), \
         patch.dict(os.environ, {'ENV': 'dev'}):
        result = lambda_handler(make_event('POST', '/api/dev/cleanup'), {})

    body = json.loads(result['body'])
    assert body == {'deletedGuests': 0, 'deletedMatches': 0, 'deletedStories': 0}
    assert deleted == []
