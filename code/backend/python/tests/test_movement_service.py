"""Step 28 — unit tests for the movement system service."""
import pytest

from app.core.models.match.movement_models import MovementError
from app.core.services.match.movement_service import MovementService

USER_ID = 7
MATCH_ID = 500
MATCH_UUID = "match-uuid"
STORY_ID = 9001


class FakeMovementStore:
    def __init__(self):
        self.users = {"user-uuid": USER_ID}
        self.match = {"id": MATCH_ID, "uuid": MATCH_UUID, "status": "RUNNING",
                      "current_clock": 3, "id_story": STORY_ID, "id_user_creator": USER_ID}
        self.character = {"id": 50, "uuid": "char-uuid", "id_location": 1, "energy": 10,
                          "energy_max": 100, "carried_weight": 0, "weight_max": 30,
                          "is_sleeping": False, "is_coma": False}
        self.characters = [{"id": 50, "id_location": 1}]
        self.locations = {
            1: {"id": 1, "uuid": "loc-1", "id_card": 7, "secure_param": 1,
                "cost_energy_enter": 1, "max_characters": 0},
            2: {"id": 2, "uuid": "loc-2", "id_card": 8, "secure_param": 1,
                "cost_energy_enter": 1, "max_characters": 0},
        }
        self.neighbors = {1: [{"id_from": 1, "id_to": 2, "direction": "NORTH",
                               "energy_cost": 2, "condition_key": None, "condition_value": None}]}
        self.weather = (3, 9)
        self.registry = {}
        self.visited = [1]
        self.updated = None
        self.logged = None

    def find_user_id_by_uuid(self, u):
        return self.users.get(u)

    def find_match_for_movement(self, uuid):
        return dict(self.match) if self.match and self.match["uuid"] == uuid else None

    def find_character_by_match_and_user(self, id_match, id_user):
        return dict(self.character) if self.character else None

    def find_characters_for_movement(self, id_match):
        return [dict(c) for c in self.characters]

    def find_location_by_uuid(self, id_story, uuid):
        for l in self.locations.values():
            if l["uuid"] == uuid:
                return dict(l)
        return None

    def find_location_by_id(self, id_story, id_location):
        l = self.locations.get(id_location)
        return dict(l) if l else None

    def find_neighbors_of_location(self, id_story, id_location):
        out = []
        for edges in self.neighbors.values():
            for e in edges:
                if e["id_from"] == id_location or e["id_to"] == id_location:
                    out.append(dict(e))
        return out

    def find_registry_value(self, id_match, key):
        return self.registry.get(key)

    def find_current_weather_move_cost(self, id_match):
        return self.weather

    def count_characters_at_location(self, id_match, id_location):
        return sum(1 for c in self.characters if c["id_location"] == id_location)

    def update_character_location_and_energy(self, id_match, id_character, id_location, energy):
        self.updated = (id_character, id_location, energy)

    def insert_movement_log(self, id_match, id_character, from_location, to_location, energy_cost):
        self.logged = (id_character, from_location, to_location, energy_cost)

    def find_visited_location_ids(self, id_match):
        return list(self.visited)


@pytest.fixture()
def store():
    return FakeMovementStore()


@pytest.fixture()
def service(store):
    return MovementService(store)


# ─── start_movement ────────────────────────────────────────────────────────────

def test_move_happy_path_safe(service, store):
    # edge 2 + entry 1 + weatherSafe 3 = 6; energy 10 -> 4
    r = service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert r.to_location_id == 2
    assert r.energy_spent == 6
    assert r.new_energy == 4
    assert store.updated == (50, 2, 4)
    assert store.logged == (50, 1, 2, 6)


def test_move_unsafe_weather(service, store):
    store.locations[2]["secure_param"] = 0  # unsafe -> weather 9
    store.character["energy"] = 20
    r = service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert r.energy_spent == 2 + 1 + 9


def test_unknown_user(service, store):
    store.users = {}
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "ghost", "loc-2")
    assert e.value.code == MovementError.MATCH_NOT_FOUND


def test_missing_match(service, store):
    store.match = None
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.MATCH_NOT_FOUND


def test_not_participant(service, store):
    store.character = None
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.MATCH_NOT_FOUND


def test_not_running(service, store):
    store.match["status"] = "CREATED"
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.MATCH_NOT_RUNNING


def test_sleeping_blocked(service, store):
    store.character["is_sleeping"] = True
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.CHARACTER_CANNOT_ACT


def test_no_location(service, store):
    store.character["id_location"] = None
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.NOT_A_NEIGHBOR


def test_unknown_target(service, store):
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-x")
    assert e.value.code == MovementError.NOT_A_NEIGHBOR


def test_not_adjacent(service, store):
    store.neighbors = {1: [{"id_from": 1, "id_to": 3, "direction": "N", "energy_cost": 1,
                            "condition_key": None, "condition_value": None}]}
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.NOT_A_NEIGHBOR


def test_condition_unmet(service, store):
    store.neighbors[1][0]["condition_key"] = "DOOR"
    store.neighbors[1][0]["condition_value"] = "OPEN"
    store.registry["DOOR"] = "CLOSED"
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.MOVEMENT_CONDITION_NOT_MET


def test_condition_met(service, store):
    store.neighbors[1][0]["condition_key"] = "DOOR"
    store.neighbors[1][0]["condition_value"] = "OPEN"
    store.registry["DOOR"] = "OPEN"
    r = service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert r.to_location_id == 2


def test_overweight(service, store):
    store.character["carried_weight"] = 40
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.OVERWEIGHT


def test_insufficient_energy(service, store):
    store.character["energy"] = 2
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.INSUFFICIENT_ENERGY
    assert store.updated is None


def test_location_full(service, store):
    store.locations[2]["max_characters"] = 1
    store.characters.append({"id": 51, "id_location": 2})
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.LOCATION_FULL


def test_null_weather_defaults_zero(service, store):
    store.weather = None
    store.locations[2]["secure_param"] = 1
    r = service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert r.energy_spent == 2 + 1 + 0


# ─── list_locations ──────────────────────────────────────────────────────────

def test_list_locations(service, store):
    result = service.list_locations(MATCH_UUID, "user-uuid")
    assert len(result) == 1
    loc = result[0]
    assert loc.character_count == 1
    assert loc.safe is True
    assert len(loc.neighbors) == 1
    # neighbor loc-2 safe: edge 2 + entry 1 + weatherSafe 3 = 6
    assert loc.neighbors[0].base_energy_cost == 2
    assert loc.neighbors[0].entry_energy_cost == 1
    assert loc.neighbors[0].weather_energy_cost == 3
    assert loc.neighbors[0].total_energy_cost == 6
    assert loc.neighbors[0].uuid == "loc-2"


def test_list_locations_skips_missing(service, store):
    store.visited = [99]
    assert service.list_locations(MATCH_UUID, "user-uuid") == []


def test_list_locations_non_owner(service, store):
    store.match["id_user_creator"] = 999
    with pytest.raises(MovementError) as e:
        service.list_locations(MATCH_UUID, "user-uuid")
    assert e.value.code == MovementError.MATCH_NOT_FOUND


def test_list_locations_admin(service, store):
    store.match["id_user_creator"] = 999
    result = service.list_locations_for_admin(MATCH_UUID)
    assert len(result) == 1


def test_list_locations_admin_missing(service, store):
    store.match = None
    with pytest.raises(MovementError):
        service.list_locations_for_admin(MATCH_UUID)
