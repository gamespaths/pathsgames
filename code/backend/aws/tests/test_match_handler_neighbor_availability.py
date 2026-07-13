"""Every neighbor of GET /api/match/{uuid}/info carries the verdict action/move would give it.

The twin of the event `available`/`reason` pair, for movement: the reason a path is closed
(coma, sleep, energy, a registry key, a full destination) travels with the path, so the board
can grey it out instead of letting the player discover it by being rejected.

Mirrors MatchQueryServiceMoveAvailabilityTest.java and
tests/test_match_query_neighbor_availability.py (python).
"""
import json
from unittest.mock import patch

from test_match_handler import PLAYER_USER, _player_event


def _body(result):
    return json.loads(result['body'])


def _story(**over):
    """Story with a single edge 1→2 (costs 1 energy); location 2 is free to enter."""
    target = {'id': 2, 'uuid': 'loc-2', 'idCard': 2}
    target.update(over.pop('target', {}))
    edge = {'idLocationFrom': 1, 'idLocationTo': 2, 'direction': 'N',
            'flagBack': 1, 'energyCost': 1, 'idCard': 3}
    edge.update(over.pop('edge', {}))
    return {
        'PK': 'STORY#story-uuid-1', 'SK': 'METADATA', 'uuid': 'story-uuid-1',
        'locations': [{'id': 1, 'uuid': 'loc-1', 'idCard': 1}, target],
        'neighbors': [edge],
        'events': [],
        'raw_cards': [], 'raw_texts': [],
    }


def _match(**over):
    m = {
        'uuid': 'm1', 'storyUuid': 'story-uuid-1', 'difficultyUuid': 'd', 'name': 'name',
        'status': 'RUNNING', 'currentClock': 0, 'expCost': 5,
        'userCreatorUuid': 'player-uuid-001', 'tsInsert': 100,
        'locations': [], 'registry': [],
    }
    m.update(over)
    return m


def _character(**over):
    c = {
        'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1',
        'userUuid': 'player-uuid-001', 'idLocation': 1,
        'energy': 100, 'weightMax': 50, 'isComa': 0, 'isSleeping': 0,
    }
    c.update(over)
    return c


def _neighbor(match_item, story_item, characters):
    def get_side(pk, sk='METADATA'):
        if pk == 'USER#player-uuid-001':
            return PLAYER_USER
        if pk == 'MATCH#m1':
            return match_item
        if pk == 'STORY#story-uuid-1':
            return story_item
        return None

    from match.handler import lambda_handler
    event = _player_event('GET', '/api/match/m1/info', path_params={'uuidMatch': 'm1'})
    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'player-uuid-001', 'source': 'mock', 'role': 'PLAYER'}), \
         patch('match.handler.db_utils.get_item', side_effect=get_side), \
         patch('match.handler.db_utils.query_by_pk', return_value=characters):
        result = lambda_handler(event, {})

    assert result['statusCode'] == 200
    neighbors = _body(result)['locationsActive'][0]['neighbors']
    assert len(neighbors) == 1
    return neighbors[0]


def test_walkable_path_is_available_with_no_reason():
    n = _neighbor(_match(), _story(), [_character()])
    assert n['available'] is True
    assert n['reason'] is None


def test_coma_closes_every_path():
    n = _neighbor(_match(), _story(), [_character(isComa=1)])
    assert n['available'] is False
    assert n['reason'] == 'COMA'


def test_sleeping_closes_every_path():
    assert _neighbor(_match(), _story(), [_character(isSleeping=1)])['reason'] == 'SLEEPING'


def test_match_not_running_closes_every_path():
    n = _neighbor(_match(status='CREATED'), _story(), [_character()])
    assert n['reason'] == 'MATCH_NOT_RUNNING'


def test_insufficient_energy_counts_edge_plus_entry():
    story = _story(target={'costEnergyEnter': 10})   # + edge 1 = 11 needed
    assert _neighbor(_match(), story, [_character(energy=10)])['reason'] == 'INSUFFICIENT_ENERGY'
    assert _neighbor(_match(), story, [_character(energy=11)])['available'] is True


def test_unmet_registry_condition_closes_the_path():
    story = _story(edge={'conditionKey': 'gate', 'conditionValue': 'open'})
    blocked = _neighbor(_match(), story, [_character()])
    assert blocked['reason'] == 'MOVEMENT_CONDITION_NOT_MET'

    # ...and the same key, set to the expected value in the match registry, opens it
    opened = _neighbor(_match(registry=[{'key': 'gate', 'stringValue': 'open'}]),
                       story, [_character()])
    assert opened['available'] is True


def test_destination_at_capacity():
    story = _story(target={'maxCharacters': 1})
    squatter = _character(SK='CHARACTER#c2', uuid='c2', userUuid='other', idLocation=2)
    n = _neighbor(_match(), story, [_character(), squatter])
    assert n['reason'] == 'LOCATION_FULL'
