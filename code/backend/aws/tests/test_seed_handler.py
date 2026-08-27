"""
Unit tests for the dev-only test-data cleanup route in seed/handler.py
(POST /api/dev/cleanup). db_utils functions are patched so no real DynamoDB
calls are made.

Everything here asserts on PARTITIONS. Until v0.34.0 the route deleted a robot match with
`delete_item(PK, "METADATA")`, which removes one row and leaves the match's `CHARACTER#…`
rows orphaned under a partition whose name is gone — residue no later run could recognise.
These tests are written so that regression cannot come back unnoticed.
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


def _run_cleanup(guests, match_rows):
    """Run the route with the scans stubbed. Returns (body, deleted partition PKs)."""
    purged = []
    from seed.handler import lambda_handler
    with patch('seed.handler.db_utils.scan_filter', return_value=guests), \
         patch('seed.handler.db_utils.scan_pk_prefix', return_value=match_rows), \
         patch('seed.handler.db_utils.delete_item',
               side_effect=AssertionError('cleanup must delete partitions, not single rows')), \
         patch('seed.handler.db_utils.delete_all_by_pk',
               side_effect=lambda pk: (purged.append(pk), 1)[1]), \
         patch.dict(os.environ, {'ENV': 'dev'}):
        result = lambda_handler(make_event('POST', '/api/dev/cleanup'), {})
    assert result['statusCode'] == 200
    return json.loads(result['body']), purged


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
    from seed.handler import SEED_STORIES

    body, purged = _run_cleanup(guests, matches)

    assert body == {
        'deletedGuests': 2,
        'deletedMatches': 1,
        'deletedStories': len(SEED_STORIES),
        'orphanMatches': 0,
    }
    # the real ("good") rows must NOT be deleted
    assert 'USER#real-1' not in purged
    assert 'MATCH#real-m' not in purged
    story_pks = [f"STORY#{s['uuid']}" for s in SEED_STORIES]
    assert sorted(p for p in purged if p not in story_pks) == \
        ['MATCH#rob-m', 'USER#rob-1', 'USER#rob-2']
    # every seed story was targeted for deletion by its STORY#{uuid} PK
    assert [p for p in purged if p in story_pks] == story_pks


def test_a_robot_match_is_removed_whole_characters_and_all():
    """The regression this route carried until v0.34.0: a match is a PARTITION.

    Deleting only its METADATA row leaves the CHARACTER# rows behind, orphaned under a
    partition whose name — the only thing that identified it — is gone, so no later run
    can recognise them either. `_run_cleanup` makes `delete_item` raise, so a row-by-row
    deletion cannot pass here again.
    """
    matches = [
        {'PK': 'MATCH#rob-m', 'SK': 'METADATA', 'name': 'robottest_step34'},
        {'PK': 'MATCH#rob-m', 'SK': 'CHARACTER#c1'},
        {'PK': 'MATCH#rob-m', 'SK': 'CHARACTER#c2'},
    ]

    body, purged = _run_cleanup([], matches)

    assert body['deletedMatches'] == 1, 'the partition is deleted once, not once per row'
    assert purged.count('MATCH#rob-m') == 1


def test_a_match_partition_with_no_metadata_is_counted_never_deleted():
    """Residue an older cleanup stranded: without METADATA there is no name to match on.

    It is reported so an operator can see it, and left alone because this route runs
    unattended after every test run — deleting what it cannot identify is not something
    to do unattended. `purge_robot_test_data.py --orphans` is the deliberate sweep.
    """
    matches = [
        {'PK': 'MATCH#orphan', 'SK': 'CHARACTER#c9'},
        {'PK': 'MATCH#real-m', 'SK': 'METADATA', 'name': 'My epic adventure'},
    ]

    body, purged = _run_cleanup([], matches)

    assert body['orphanMatches'] == 1
    assert body['deletedMatches'] == 0
    assert 'MATCH#orphan' not in purged


def test_a_real_match_is_never_counted_as_an_orphan():
    """A match with characters AND metadata is intact, not residue."""
    matches = [
        {'PK': 'MATCH#real-m', 'SK': 'METADATA', 'name': 'My epic adventure'},
        {'PK': 'MATCH#real-m', 'SK': 'CHARACTER#c1'},
    ]

    body, purged = _run_cleanup([], matches)

    assert body['orphanMatches'] == 0
    assert 'MATCH#real-m' not in purged


def test_cleanup_with_no_robot_data_returns_zero():
    guests = [{'PK': 'USER#real-1', 'SK': 'METADATA', 'username': 'guest_real0001', 'is_guest': True}]
    matches = [{'PK': 'MATCH#real-m', 'SK': 'METADATA', 'name': 'Real match'}]
    deleted = []
    from seed.handler import lambda_handler
    with patch('seed.handler.db_utils.scan_filter', return_value=guests), \
         patch('seed.handler.db_utils.scan_pk_prefix', return_value=matches), \
         patch('seed.handler.db_utils.delete_item',
               side_effect=lambda pk, sk='METADATA': deleted.append(pk)), \
         patch('seed.handler.db_utils.delete_all_by_pk',
               side_effect=lambda pk: (deleted.append(pk), 0)[1]), \
         patch.dict(os.environ, {'ENV': 'dev'}):
        result = lambda_handler(make_event('POST', '/api/dev/cleanup'), {})

    body = json.loads(result['body'])
    assert body == {'deletedGuests': 0, 'deletedMatches': 0, 'deletedStories': 0,
                    'orphanMatches': 0}
    # Only the seed stories were attempted, and they held nothing.
    from seed.handler import SEED_STORIES
    assert deleted == [f"STORY#{s['uuid']}" for s in SEED_STORIES]
