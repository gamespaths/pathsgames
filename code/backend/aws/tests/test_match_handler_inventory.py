"""Steps 34 & 35 — the four inventory routes on the AWS backend.

The engine itself is covered by test_inventory.py; what is exercised here is the routing,
the payload shape and the persistence, in particular that use-item answers the
execute-event body with a null eventUuid and the item's own card.

jwt_utils and db_utils are patched; no AWS calls are made.
"""
import json
from unittest.mock import patch

from helpers import make_event

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'guest', 'role': 'PLAYER'}

CHARACTER = {
    'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'userUuid': 'u1',
    'idLocation': 1, 'energy': 10, 'coin': 0, 'life': 10, 'lifeMax': 20, 'sad': 0,
    'sadMax': 50, 'exp': 0, 'food': 4, 'magic': 2, 'weightMax': 30,
    'classUuid': 'cl1', 'idClass': 7, 'isSleeping': 0, 'isComa': 0,
    'items': [
        {'uuid': 'row-1', 'idItem': 900, 'amount': 2, 'state': 'ACTIVE'},
        {'uuid': 'row-2', 'idItem': 901, 'amount': 1, 'state': 'ACTIVE'},
    ],
}

MATCH = {
    'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
    'currentClock': 1, 'userCreatorUuid': 'u1', 'storyUuid': 's1',
}

STORY = {
    'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
    'items': [
        {'id': 900, 'uuid': 'item-900', 'weight': 3, 'isConsumabile': 1,
         'idCard': 1, 'idTextName': 201},
        {'id': 901, 'uuid': 'item-901', 'weight': 5, 'isConsumabile': 0,
         'idCard': None, 'idTextName': None},
    ],
    'itemEffects': [
        {'id': 1, 'uuid': 'ief-1', 'idItem': 900, 'effectCode': 'LIFE',
         'effectValue': 3, 'idCard': 1},
    ],
    'traits': [{'id': 7, 'uuid': 'trait-7'}],
    'raw_cards': [
        {'id': 1, 'uuid': 'card-1', 'cardType': 'item', 'idTextTitle': 201,
         'idTextDescription': 202, 'awesomeIcon': 'fa-flask', 'urlImage': None},
    ],
    'raw_texts': [
        {'idText': 201, 'lang': 'en', 'shortText': 'Healing Potion'},
        {'idText': 201, 'lang': 'it', 'shortText': 'Pozione curativa'},
        {'idText': 202, 'lang': 'en', 'shortText': 'It smells of herbs.'},
    ],
}


def _get_side(pk, sk='METADATA'):
    if pk.startswith('USER#'):
        return USER
    if pk.startswith('MATCH#'):
        return dict(MATCH)
    if pk.startswith('STORY#'):
        return STORY
    return None


def _call(method, path, body=None, qs=None):
    from match.handler import lambda_handler
    event = make_event(method, path, body=body,
                       headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                       path_params={'uuidMatch': 'm1'}, qs=qs)
    return lambda_handler(event, {})


def _patched(fn):
    """The four patches every route test needs, in one decorator."""
    fn = patch('match.handler.db_utils.get_item', side_effect=_get_side)(fn)
    fn = patch('match.handler.db_utils.query_by_pk',
               return_value=[json.loads(json.dumps(CHARACTER))])(fn)
    fn = patch('match.handler.db_utils.put_item')(fn)
    fn = patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})(fn)
    return fn


# ── GET /inventory ──────────────────────────────────────────────────────────

@_patched
def test_inventory_lists_the_rows_with_their_cards(_get, _query, _put, _jwt):
    result = _call('GET', '/api/gameplay/m1/inventory', qs={'lang': 'it'})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['matchUuid'] == 'm1'
    assert body['characterUuid'] == 'c1'
    # 3 x 2 + 5 x 1
    assert body['weight'] == 11
    assert body['weightMax'] == 30
    first = body['items'][0]
    assert first['uuid'] == 'row-1'
    assert first['itemUuid'] == 'item-900'
    assert first['amount'] == 2
    assert first['idCard'] == 1
    assert first['card']['title'] == 'Pozione curativa'
    assert first['name'] == 'Pozione curativa'
    assert first['isConsumabile'] is True
    # Step 35 — the listing promises what using it would apply, read off the very rows
    # use-item runs. The non-consumable one carries no effect row, hence [].
    assert first['effects'] == [{'statistic': 'life', 'value': 3}]
    # The non-consumable one is listed too — it is carried, just not usable.
    assert body['items'][1]['isConsumabile'] is False
    assert body['items'][1]['card'] is None
    assert body['items'][1]['effects'] == []


def test_inventory_hides_the_promise_of_a_secret_item(_put=None):
    """v0.35.0 — flagShowEffects = 0: the row is listed like any other and promises
    nothing, even though its effect row is right there in the story. Its own story and its
    own character, so the weights the other cases assert stay untouched."""
    story = {
        'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
        'items': [
            {'id': 900, 'uuid': 'item-900', 'weight': 1, 'isConsumabile': 1,
             'idCard': None, 'idTextName': None},
            # The unlabelled bottle: it DOES something, and says nothing about it.
            {'id': 902, 'uuid': 'item-902', 'weight': 1, 'isConsumabile': 1,
             'idCard': None, 'idTextName': None, 'flagShowEffects': 0},
        ],
        'itemEffects': [
            {'id': 1, 'uuid': 'ief-1', 'idItem': 900, 'effectCode': 'LIFE', 'effectValue': 3},
            {'id': 2, 'uuid': 'ief-2', 'idItem': 902, 'effectCode': 'ENERGY', 'effectValue': 2},
        ],
    }
    character = dict(json.loads(json.dumps(CHARACTER)), items=[
        {'uuid': 'row-1', 'idItem': 900, 'amount': 1, 'state': 'ACTIVE'},
        {'uuid': 'row-9', 'idItem': 902, 'amount': 1, 'state': 'ACTIVE'},
    ])

    def _side(pk, sk='METADATA'):
        return story if pk.startswith('STORY#') else _get_side(pk, sk)

    with patch('match.handler.db_utils.get_item', side_effect=_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=[character]), \
         patch('match.handler.db_utils.put_item'), \
         patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'}):
        body = json.loads(_call('GET', '/api/gameplay/m1/inventory')['body'])

    ordinary, secret = body['items']
    assert ordinary['effects'] == [{'statistic': 'life', 'value': 3}]
    assert secret['itemUuid'] == 'item-902'
    assert secret['effects'] == []
    # Listed, weighed and usable like any other row: only the promise is missing.
    assert secret['isConsumabile'] is True
    assert body['weight'] == 2


# ── GET /resources ──────────────────────────────────────────────────────────

@_patched
def test_resources_are_plain_numbers(_get, _query, _put, _jwt):
    result = _call('GET', '/api/gameplay/m1/resources')

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert (body['food'], body['magic'], body['coin']) == (4, 2, 0)
    assert body['weight'] == 11
    assert body['weightMax'] == 30
    assert 'card' not in body


# ── POST /use-item ──────────────────────────────────────────────────────────

@_patched
def test_use_item_answers_the_execute_event_shape(_get, _query, _put, _jwt):
    result = _call('POST', '/api/gameplay/m1/inventory/use-item',
                   body={'itemInstanceUuid': 'row-1'})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['status'] == 'APPLIED'
    # An item owns no event.
    assert body['eventUuid'] is None
    assert body['eventType'] is None
    assert body['pendingChoices'] == []
    assert body['executedEventUuids'] == []
    assert body['energySpent'] == 0
    # The card is the ITEM's own.
    assert body['card']['title'] == 'Healing Potion'
    assert body['itemRemoved'] is True
    # The effect ran through the shared engine.
    assert body['statChanges'][0]['statistic'] == 'life'
    assert body['statChanges'][0]['after'] == 13
    assert body['effects'][0]['effectUuid'] == 'ief-1'
    assert body['effects'][0]['target'] == 'ONLY_ONE'


@_patched
def test_use_item_removes_the_whole_row_and_logs_the_usage(_get, _query, _put, _jwt):
    _call('POST', '/api/gameplay/m1/inventory/use-item', body={'itemInstanceUuid': 'row-1'})

    written = [c.args[0] for c in _put.call_args_list]
    char = next(w for w in written if str(w.get('SK', '')).startswith('CHARACTER#'))
    match = next(w for w in written if w.get('SK') == 'METADATA')
    # The row is gone — amount was 2 and is NOT decremented.
    assert [r['uuid'] for r in char['items']] == ['row-2']
    assert match['itemUsageLog'][0]['idItem'] == 900
    assert match['itemUsageLog'][0]['counter'] == 1


@_patched
def test_use_item_refuses_a_non_consumable(_get, _query, _put, _jwt):
    result = _call('POST', '/api/gameplay/m1/inventory/use-item',
                   body={'itemInstanceUuid': 'row-2'})

    assert result['statusCode'] == 409
    assert json.loads(result['body'])['error'] == 'ITEM_NOT_CONSUMABLE'
    _put.assert_not_called()


@_patched
def test_use_item_refuses_an_unknown_row(_get, _query, _put, _jwt):
    result = _call('POST', '/api/gameplay/m1/inventory/use-item',
                   body={'itemInstanceUuid': 'theirs'})

    assert result['statusCode'] == 404
    assert json.loads(result['body'])['error'] == 'ITEM_NOT_FOUND'


@_patched
def test_use_item_requires_the_row_uuid(_get, _query, _put, _jwt):
    result = _call('POST', '/api/gameplay/m1/inventory/use-item', body={})

    assert result['statusCode'] == 400
    assert json.loads(result['body'])['error'] == 'MISSING_ITEM'


# ── POST /drop-item ─────────────────────────────────────────────────────────

@_patched
def test_drop_item_discards_a_non_consumable_too(_get, _query, _put, _jwt):
    result = _call('POST', '/api/gameplay/m1/inventory/drop-item',
                   body={'itemInstanceUuid': 'row-2'})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['itemInstanceUuid'] == 'row-2'
    assert body['itemUuid'] == 'item-901'
    assert body['amountDropped'] == 1
    # Only the 3 x 2 row is left.
    assert body['weight'] == 6
    assert body['refreshRecommended'] is True


@_patched
def test_drop_item_never_writes_a_usage_log(_get, _query, _put, _jwt):
    _call('POST', '/api/gameplay/m1/inventory/drop-item', body={'itemInstanceUuid': 'row-1'})

    written = [c.args[0] for c in _put.call_args_list]
    assert not any('itemUsageLog' in w for w in written)


@_patched
def test_drop_item_requires_the_row_uuid(_get, _query, _put, _jwt):
    result = _call('POST', '/api/gameplay/m1/inventory/drop-item', body={})
    assert result['statusCode'] == 400
    assert json.loads(result['body'])['error'] == 'MISSING_ITEM'


# ── shared refusals ─────────────────────────────────────────────────────────

@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.query_by_pk', return_value=[])
@patch('match.handler.db_utils.get_item', side_effect=_get_side)
def test_a_caller_with_no_character_is_a_not_found(_get, _query, _put, _jwt):
    for method, path in [('GET', '/api/gameplay/m1/inventory'),
                         ('GET', '/api/gameplay/m1/resources')]:
        result = _call(method, path)
        assert result['statusCode'] == 404
        assert json.loads(result['body'])['error'] == 'MATCH_NOT_FOUND'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.query_by_pk',
       return_value=[json.loads(json.dumps(CHARACTER))])
@patch('match.handler.db_utils.get_item',
       side_effect=lambda pk, sk='METADATA': (
           USER if pk.startswith('USER#')
           else {**MATCH, 'status': 'PAUSED'} if pk.startswith('MATCH#')
           else STORY))
def test_a_paused_match_refuses_both_actions(_get, _query, _put, _jwt):
    for path in ['/api/gameplay/m1/inventory/use-item',
                 '/api/gameplay/m1/inventory/drop-item']:
        result = _call('POST', path, body={'itemInstanceUuid': 'row-1'})
        assert result['statusCode'] == 409
        assert json.loads(result['body'])['error'] == 'MATCH_NOT_RUNNING'


@patch('match.handler.jwt_utils.verify_access_token',
       return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'})
@patch('match.handler.db_utils.put_item')
@patch('match.handler.db_utils.query_by_pk',
       return_value=[{**json.loads(json.dumps(CHARACTER)),
                      'items': [{'uuid': 'row-9', 'idItem': 999, 'amount': 2,
                                 'state': 'ACTIVE'}]}])
@patch('match.handler.db_utils.get_item', side_effect=_get_side)
def test_a_row_whose_story_item_is_gone_is_still_droppable(_get, _query, _put, _jwt):
    """A re-import can strand a row. Dropping it must work, or it weighs the character
    down forever; using it cannot, since the effects live on the missing story item."""
    dropped = _call('POST', '/api/gameplay/m1/inventory/drop-item',
                    body={'itemInstanceUuid': 'row-9'})

    assert dropped['statusCode'] == 200
    body = json.loads(dropped['body'])
    assert body['itemUuid'] is None, 'there is no story item to name'
    assert body['amountDropped'] == 2
    assert body['weight'] == 0

    used = _call('POST', '/api/gameplay/m1/inventory/use-item',
                 body={'itemInstanceUuid': 'row-9'})
    assert used['statusCode'] == 404
    assert json.loads(used['body'])['error'] == 'ITEM_NOT_FOUND'


# ── /info with a bag that is not empty ───────────────────────────────────────
#
# The suite above drives the four inventory routes. This last block drives /info, and it
# exists because of a 500 that only ever appeared when BOTH halves were true: the story
# declared items AND the character carried one. Every earlier test had one half or the
# other, so the crash lived through a full green suite and only surfaced in the deployed
# environment. The story here is therefore built by the REAL seed writer, not by hand.

def _seeded_story_with_items():
    """The tutorial story exactly as `_seed_stories` writes it to DynamoDB.

    Hand-written fixtures do not reproduce this: `story["texts"]` is a per-language dict of
    the story's own title/description, while the text ROWS live under `raw_texts`. Handing
    the former to the card resolver is what produced the 500.
    """
    written = []
    with patch('seed.handler.db_utils.put_item', side_effect=written.append), \
         patch('seed.handler.db_utils.delete_all_by_pk', return_value=0):
        from seed.handler import _seed_stories
        _seed_stories()
    return next(s for s in written
                if s['PK'].startswith('STORY#') and s.get('items'))


def _info_env(char_items, requester='u1'):
    """(story, get_item side effect, character) for a /info call."""
    story = _seeded_story_with_items()
    match = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
             'currentClock': 1, 'userCreatorUuid': requester,
             'storyUuid': story['uuid'], 'locations': [], 'registry': []}
    char = {**json.loads(json.dumps(CHARACTER)), 'items': char_items}

    def get_side(pk, sk='METADATA'):
        if pk.startswith('USER#'):
            return USER
        if pk.startswith('MATCH#'):
            return dict(match)
        if pk.startswith('STORY#'):
            return story
        return None

    return story, get_side, char


def _call_info(get_side, characters, path='/api/match/m1/info'):
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'}), \
         patch('match.handler.db_utils.put_item'), \
         patch('match.handler.db_utils.query_by_pk', return_value=characters), \
         patch('match.handler.db_utils.get_item', side_effect=get_side):
        from match.handler import lambda_handler
        return lambda_handler(make_event('GET', path,
                                         headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                                         path_params={'uuidMatch': 'm1'}), {})


def test_info_resolves_a_carried_item_against_the_real_seed_story():
    _story, get_side, char = _info_env(
        [{'uuid': 'row-1', 'idItem': 1, 'amount': 2, 'state': 'ACTIVE'}])

    result = _call_info(get_side, [char])

    assert result['statusCode'] == 200, result['body'][:300]
    player = json.loads(result['body'])['players'][0]
    row = player['items'][0]
    assert row['uuid'] == 'row-1'
    assert row['itemUuid'], 'the story item must be resolved, not left null'
    assert row['card'] is not None, 'the card object is what the board renders'
    assert row['card']['title'], 'the card title comes from raw_texts, not story["texts"]'
    assert row['isConsumabile'] is not None
    assert player['weight'] == row['weight'] * 2


def test_info_masks_the_other_players_items_but_not_their_weight():
    _story, get_side, mine = _info_env(
        [{'uuid': 'row-1', 'idItem': 1, 'amount': 1, 'state': 'ACTIVE'}])
    theirs = {**json.loads(json.dumps(mine)), 'SK': 'CHARACTER#c2', 'uuid': 'c2',
              'userUuid': 'u2',
              'items': [{'uuid': 'row-2', 'idItem': 1, 'amount': 3, 'state': 'ACTIVE'}]}

    result = _call_info(get_side, [mine, theirs])

    assert result['statusCode'] == 200
    players = {p['uuid']: p for p in json.loads(result['body'])['players']}
    assert len(players['c1']['items']) == 1
    assert players['c2']['items'] == [], "another player's bag is not the caller's business"
    # The scalar total is NOT masked: it says a rival is heavy, not what they carry.
    assert players['c2']['weight'] > 0


def test_info_reports_the_backpack_resources_on_every_player():
    _story, get_side, char = _info_env([])

    result = _call_info(get_side, [char])

    player = json.loads(result['body'])['players'][0]
    assert (player['food'], player['magic']) == (4, 2)
    assert player['items'] == []
    assert player['weight'] == 0
