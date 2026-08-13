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


def test_seed_step29_events_cover_every_check_branch():
    """Step 29: the tutorial story seeds one event per branch of the check procedure, plus
    the unlocker for each blocked one — this is what the robot suite drives."""
    from seed.handler import SEED_STORIES
    tutorial = SEED_STORIES[0]
    events = {e['id']: e for e in tutorial['events']}
    effects = tutorial['eventEffects']

    # Every event offered on /info must resolve a card: the suite executes an arbitrary
    # available one and expects a localized card back, so a null idCard breaks it.
    offered = [e for e in tutorial['events']
               if e['type'] in ('NORMAL', 'ONCE') and e.get('idSpecificLocation')]
    assert offered and all(e.get('idCard') for e in offered)

    assert events[10]['costEnery'] == 1 and events[10]['type'] == 'NORMAL'
    assert events[11]['type'] == 'ONCE'
    assert events[12]['costEnery'] == 999                       # NOT_ENOUGH_ENERGY
    assert events[13]['coinCost'] == 999                        # NOT_ENOUGH_COINS
    assert events[14]['registryKeyCondition'] == 'STEP29_GATE'  # REGISTRY_CONDITION_NOT_MET
    assert events[15]['idClassCondition'] == 1                  # CLASS_CONDITION_NOT_MET
    assert events[16]['idWeather'] == 3                         # WEATHER_CONDITION_NOT_MET
    assert events[17]['idSpecificLocation'] == 2                # WRONG_LOCATION
    assert events[18]['idEventNext'] == 19                      # chain head -> tail
    assert events[19]['idSpecificLocation'] is None             # tail is not listed on /info
    assert events[24]['idItemCondition'] == 1                   # ITEM_CONDITION_NOT_MET
    assert events[27]['type'] == 'AUTOMATIC'                    # EVENT_NOT_EXECUTABLE_TYPE

    # Each gate has the effect that opens it.
    assert any(e.get('keyToAdd') == 'STEP29_GATE' for e in effects)
    assert any(e.get('itemAction') == 'ADD' and e['idEvent'] == 25 for e in effects)
    assert any(e.get('idWeather') == 3 for e in effects)

    # The backpack resources land on one single event, so the suite finds them together.
    resources = {e['statistics']: e['value'] for e in effects
                 if e['idEvent'] == 26 and e.get('statistics')}
    assert resources == {'food': 3, 'magic': 2, 'coin': 9}


def test_seed_gives_every_effect_row_a_uuid():
    """v0.33.2: an AppliedEffect names its row through `effectUuid`, read straight off the
    effect. No seeded row ever declared a uuid, so every AppliedEffect AWS returned — from
    execute-event, from a resolved choice, from an automatic event — named a null effect."""
    put_items = []
    from seed.handler import lambda_handler
    with patch('seed.handler.db_utils.put_item', side_effect=lambda item: put_items.append(item)), \
         patch('seed.handler.db_utils.delete_all_by_pk', return_value=0), \
         patch.dict(os.environ, {'ENV': 'dev'}):
        lambda_handler(make_event('POST', '/api/dev/seed'), {})

    stories = [i for i in put_items if i['PK'].startswith('STORY#')]
    assert stories
    seen = set()
    total = 0
    for story in stories:
        # Not every seeded story authors effects — the second one seeds no event at all.
        rows = (story.get('eventEffects') or []) + (story.get('choiceEffects') or [])
        total += len(rows)
        for row in rows:
            assert row.get('uuid'), f"effect {row.get('id')} has no uuid"
            # Unique across stories: the prefix carries the story uuid precisely so two
            # stories numbering their effects from 1 cannot collide.
            assert row['uuid'] not in seen, f"duplicate effect uuid {row['uuid']}"
            seen.add(row['uuid'])
    assert total, 'no seeded story authors an effect row at all'


def test_seed_effect_uuids_are_stable_and_respect_authored_ones():
    """Derived from the id, not random: a reseed must not rename a row that already
    travelled to a client. An authored uuid wins over the derived one."""
    from seed.handler import _ensure_effect_uuids

    rows = [{"id": 1, "statistics": "exp"}, {"id": 2, "uuid": "eff-authored"}]
    first = _ensure_effect_uuids(rows, "eff-story")
    second = _ensure_effect_uuids(rows, "eff-story")

    assert first[0]['uuid'] == 'eff-story-1'
    assert first == second
    assert first[1]['uuid'] == 'eff-authored'
    # The caller's rows are left alone: the seed literal is module-level and reused.
    assert 'uuid' not in rows[0]


def test_seed_route_blocked_outside_dev():
    from seed.handler import lambda_handler
    with patch.dict(os.environ, {'ENV': 'prod'}):
        result = lambda_handler(make_event('POST', '/api/dev/seed'), {})
    assert result['statusCode'] == 403
