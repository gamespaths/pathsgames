"""Every neighbor of GET /api/match/{uuid}/info carries the verdict that action/move would
give it — the twin of the event `available`/`reason` pair, for movement. The reason a path is
closed (coma, sleep, energy, a registry key, a full destination) travels with the path, so the
board never has to guess.

Mirrors ``MatchQueryServiceMoveAvailabilityTest.java``.
"""
from unittest.mock import MagicMock

from app.core.services.match.match_query_service import MatchQueryService

HERE = 10
THERE = 12
MATCH_ID = 99
USER_ID = 7


def _character(loc=HERE):
    return {
        "id": 1, "uuid": "char-uuid", "id_user": USER_ID, "id_character_template": 90001,
        "dexterity": 5, "intelligence": 4, "constitution": 3, "energy": 9,
        "life": 8, "sad": 0, "is_sleeping": 0, "is_coma": 0, "id_location": loc,
    }


def _mover(coma=False, sleeping=False, energy=100):
    """The movement store's view of the caller: awake, unburdened, well fed by default."""
    return {
        "id": 1, "uuid": "char-uuid", "id_user": USER_ID, "id_location": HERE,
        "energy": energy, "energy_max": 100, "carried_weight": 0, "weight_max": 50,
        "is_sleeping": 1 if sleeping else 0, "is_coma": 1 if coma else 0,
    }


def _build(mover=None, target_overrides=None, edge_overrides=None, registry=None,
           characters_at_target=0, status="RUNNING"):
    persistence = MagicMock()
    story_read = MagicMock()
    user_access = MagicMock()
    character_read = MagicMock()
    movement_store = MagicMock()

    user_access.find_by_uuid.return_value = {"id": USER_ID, "uuid": "u"}
    persistence.find_match_by_uuid.return_value = {
        "id": MATCH_ID, "uuid": "match-uuid", "id_story": 2, "id_difficulty": 3,
        "id_user_creator": USER_ID, "name": "n", "status": status, "current_clock": 1,
        "exp_cost": 5, "ts_insert": "now", "ts_update": "now", "single_player": 1,
        "character_template_uuid": "ct", "class_uuid": "cl", "trait_uuids": [],
    }
    story_read.find_story_by_id.return_value = {
        "id": 2, "uuid": "story-uuid", "id_location_start": HERE,
    }
    story_read.find_difficulty_by_id.return_value = {"id": 3, "uuid": "diff-uuid"}

    target = {"id": THERE, "uuid": "loc-there", "id_card": 120,
              "cost_energy_enter": 0, "secure_param": 0, "max_characters": 0}
    target.update(target_overrides or {})
    story_read.find_locations_by_story_id.return_value = [
        {"id": HERE, "uuid": "loc-here", "id_card": 100}, target,
    ]

    edge = {"id_location_from": HERE, "id_location_to": THERE, "direction": "N",
            "flag_back": 1, "energy_cost": 5, "id_card": 200}
    edge.update(edge_overrides or {})
    story_read.find_location_neighbors_by_story_id.return_value = [edge]
    story_read.find_events_by_story_id.return_value = []
    story_read.find_character_templates_by_story_id.return_value = [
        {"id_tipo": 90001, "uuid": "tpl-uuid"}
    ]
    story_read.find_traits_by_story_id.return_value = []
    story_read.find_items_by_story_id.return_value = []
    story_read.find_card_by_story_and_card_id.return_value = None

    persistence.find_locations_by_match_id.return_value = []
    persistence.find_registry_by_match_id.return_value = registry or []

    character_read.find_characters_by_match_id.return_value = [_character()]
    character_read.find_backpack.return_value = None
    character_read.find_traits.return_value = []
    character_read.find_inventory.return_value = []

    caller = _mover() if mover is None else mover
    movement_store.find_visited_location_ids.return_value = [HERE, THERE]
    movement_store.find_character_by_match_and_user.return_value = caller
    movement_store.find_current_weather_move_cost.return_value = (0, 0)
    others = [dict(caller, id=i + 2, id_location=THERE) for i in range(characters_at_target)]
    movement_store.find_characters_for_movement.return_value = (
        ([caller] if caller else []) + others)

    return MatchQueryService(persistence, story_read, user_access, character_read,
                             movement_store=movement_store)


def _neighbor(service):
    detail = service.get_match_info("match-uuid", "u")
    neighbors = detail.locations_active[0].neighbors
    assert len(neighbors) == 1
    return neighbors[0]


def test_walkable_path_is_available_with_no_reason():
    n = _neighbor(_build())
    assert n.available
    assert n.reason is None


def test_coma_closes_every_path():
    n = _neighbor(_build(mover=_mover(coma=True)))
    assert not n.available
    assert n.reason == "COMA"


def test_sleeping_closes_every_path():
    assert _neighbor(_build(mover=_mover(sleeping=True))).reason == "SLEEPING"


def test_insufficient_energy_counts_edge_plus_entry():
    # edge 5 + entry 10 = 15 needed
    target = {"cost_energy_enter": 10}
    assert _neighbor(_build(mover=_mover(energy=14),
                            target_overrides=target)).reason == "INSUFFICIENT_ENERGY"
    # one more energy point and the same path opens
    assert _neighbor(_build(mover=_mover(energy=15), target_overrides=target)).available


def test_unmet_registry_condition_closes_the_path():
    gated = {"condition_registry_key": "gate", "condition_registry_value": "open"}
    assert _neighbor(_build(edge_overrides=gated)).reason == "MOVEMENT_CONDITION_NOT_MET"
    # ...and the same key, set to the expected value in the match registry, opens it
    opened = _build(edge_overrides=gated,
                    registry=[{"uuid": "r1", "key": "gate", "string_value": "open"}])
    assert _neighbor(opened).available


def test_destination_at_capacity():
    assert _neighbor(_build(target_overrides={"max_characters": 1},
                            characters_at_target=1)).reason == "LOCATION_FULL"


def test_no_character_never_yields_a_silent_yes():
    # the store knows no character for this user: the path must read blocked, not open
    service = _build()
    service.movement_store.find_character_by_match_and_user.return_value = None
    blocked = _neighbor(service)
    assert not blocked.available
    assert blocked.reason == "CHARACTER_CANNOT_ACT"


def test_match_not_running_closes_every_path():
    assert _neighbor(_build(status="CREATED")).reason == "MATCH_NOT_RUNNING"
