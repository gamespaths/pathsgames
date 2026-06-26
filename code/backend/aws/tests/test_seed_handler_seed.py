"""Coverage for the default /api/dev/seed route in seed/handler.py — exercises
the user seed loop and `_seed_stories`. db_utils is patched so no real DynamoDB
calls are made."""
import json
import os
from unittest.mock import patch

from helpers import make_event


def test_seed_route_inserts_users_and_stories():
    put_items = []
    from seed.handler import lambda_handler, SEED_STORIES, SEED_USERS
    with patch('seed.handler.db_utils.put_item', side_effect=lambda item: put_items.append(item)), \
         patch('seed.handler.db_utils.delete_all_by_pk', return_value=0), \
         patch.dict(os.environ, {'ENV': 'dev'}):
        result = lambda_handler(make_event('POST', '/api/dev/seed'), {})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['status'] == 'SEEDED'
    assert len(body['inserted']) == len(SEED_USERS)
    assert len(body['stories']) == len(SEED_STORIES)
    # every inserted user carries an access token
    assert all(u['accessToken'] for u in body['inserted'])
    # both users and stories were written
    assert any(i['PK'].startswith('USER#') for i in put_items)
    assert any(i['PK'].startswith('STORY#') for i in put_items)

    # Step 0.28.2 — seeded stories expose `locationNeighbors` (the admin-CRUD field)
    # mirroring `neighbors`, so neighbors of seeded stories are admin-editable, not
    # only playable. Guards the AWS gap where admin location-neighbors was empty.
    stories_with_neighbors = [i for i in put_items
                              if i['PK'].startswith('STORY#') and i.get('neighbors')]
    assert stories_with_neighbors, 'expected at least one seeded story with neighbors'
    for s in stories_with_neighbors:
        assert s.get('locationNeighbors') == s['neighbors']


def test_seed_route_blocked_outside_dev():
    from seed.handler import lambda_handler
    with patch.dict(os.environ, {'ENV': 'prod'}):
        result = lambda_handler(make_event('POST', '/api/dev/seed'), {})
    assert result['statusCode'] == 403
