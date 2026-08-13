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
                               "energy_cost": 2, "condition_key": None, "condition_value": None,
                               "flag_back": 1}]}
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


def test_step33_arrival_triggers_run_after_the_move_is_committed(store):
    """Step 33 — the destination's entry triggers run once the move is committed, and what
    they did comes back on the movement response."""
    from unittest.mock import MagicMock
    from app.core.models.match import location_entry_models as lem

    entry = MagicMock()
    fired = lem.AutomaticEventFired(lem.TRIGGER_FIRST_ENTRY, 2, "evt-welcome")
    entry.on_arrival.return_value = [fired]
    service = MovementService(store, location_entry=entry)

    r = service.start_movement(MATCH_UUID, "user-uuid", "loc-2")

    assert [f.event_uuid for f in r.automatic_events] == ["evt-welcome"]
    # The trigger resolution reads the character's NEW position, so it must run after both
    # writes, never between them.
    assert store.updated == (50, 2, 4)
    assert store.logged == (50, 1, 2, 6)
    arrival = entry.on_arrival.call_args[0][0]
    assert (arrival.id_character, arrival.id_location) == (50, 2)


def test_step33_without_the_location_engine_a_move_behaves_as_before(service):
    r = service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert r.automatic_events == []


def test_step33_a_refused_move_fires_no_arrival_trigger(store):
    """Nobody arrived, so nothing may fire."""
    from unittest.mock import MagicMock

    entry = MagicMock()
    service = MovementService(store, location_entry=entry)
    store.character["energy"] = 1  # against a cost of 6

    with pytest.raises(MovementError):
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    entry.on_arrival.assert_not_called()


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
    assert e.value.code == MovementError.SLEEPING


def test_coma_blocked(service, store):
    """Coma outranks sleep: a comatose character is also asleep, and only a rescue helps."""
    store.character["is_sleeping"] = True
    store.character["is_coma"] = True
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.COMA


def test_no_location(service, store):
    store.character["id_location"] = None
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-2")
    assert e.value.code == MovementError.NOT_A_NEIGHBOR


def test_unknown_target(service, store):
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-x")
    assert e.value.code == MovementError.NOT_A_NEIGHBOR


def test_one_way_backward_blocked(service, store):
    # Edge 1->2 is one-way (flag_back=0). Character stands on 2 and tries to go back to 1.
    store.neighbors[1][0]["flag_back"] = 0
    store.character["id_location"] = 2
    with pytest.raises(MovementError) as e:
        service.start_movement(MATCH_UUID, "user-uuid", "loc-1")
    assert e.value.code == MovementError.NOT_A_NEIGHBOR


def test_one_way_backward_hidden_in_locations(service, store):
    # Edge 1->2 one-way: standing on 2, location 1 must not appear as a neighbor.
    store.neighbors[1][0]["flag_back"] = 0
    store.character["id_location"] = 2
    store.characters = [dict(store.character)]
    store.visited = [2]
    result = service.list_locations(MATCH_UUID, "user-uuid")
    assert len(result) == 1
    assert result[0].neighbors == []


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


def test_list_locations_carries_authored_endpoints(service, store):
    """`direction` is the authored from→to one, so the endpoints must travel with it:
    without them a client cannot tell a forward traversal from a return one."""
    store.visited = [2]
    store.neighbors = {2: [{"id_from": 1, "id_to": 2, "direction": "NORTH",
                            "energy_cost": 2, "flag_back": 1}]}
    nb = service.list_locations(MATCH_UUID, "user-uuid")[0].neighbors[0]
    assert nb.direction == "NORTH"
    assert nb.id_location_from == 1
    assert nb.id_location_to == 2


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


# ─── location/neighbor card resolution (Step 0.28.5) ─────────────────────────

class FakeStoryReadPort:
    """Cards by (story, id_card) and localized texts by (story, id_text, lang)."""

    def __init__(self):
        self.cards = {
            (STORY_ID, 7): {"uuid": "card-7", "card_type": "location",
                            "url_image": "http://img/7.jpg", "id_text_title": 100,
                            "id_text_description": 101, "link_copyright": "http://c/7"},
            (STORY_ID, 8): {"uuid": "card-8", "card_type": "location",
                            "url_image": "http://img/8.jpg", "id_text_title": 200},
        }
        self.texts = {
            (STORY_ID, 100, "en"): {"short_text": "Start hall"},
            (STORY_ID, 100, "it"): {"short_text": "Sala iniziale"},
            (STORY_ID, 101, "en"): {"short_text": "The start"},
            (STORY_ID, 200, "en"): {"short_text": "Center"},
        }

    def find_card_by_story_id_and_card_id(self, story_id, id_card):
        return self.cards.get((story_id, id_card))

    def find_text_by_story_id_text_and_lang(self, story_id, id_text, lang):
        return self.texts.get((story_id, id_text, lang))


@pytest.fixture()
def service_with_cards(store):
    return MovementService(store, FakeStoryReadPort())


def test_list_locations_resolves_location_and_neighbor_cards(service_with_cards, store):
    store.visited = [1, 2]  # neighbor 2 visited → its location card is exposed
    loc = service_with_cards.list_locations(MATCH_UUID, "user-uuid")[0]
    assert loc.card["uuid"] == "card-7"
    assert loc.card["title"] == "Start hall"
    assert loc.card["urlImage"] == "http://img/7.jpg"
    assert loc.card["description"] == "The start"
    nb = loc.neighbors[0]
    assert nb.id_card == 8
    assert nb.card["uuid"] == "card-8"
    assert nb.card["title"] == "Center"


def test_list_locations_hides_unvisited_neighbor_card(service_with_cards, store):
    # Fog of war: neighbor 2 has never been visited (visited = [1]) → its
    # location card and idCard must be hidden.
    store.visited = [1]
    loc = service_with_cards.list_locations(MATCH_UUID, "user-uuid")[0]
    nb = loc.neighbors[0]
    assert nb.id_card is None
    assert nb.card is None
    assert loc.card["uuid"] == "card-7"  # the visited location keeps its card


def test_list_locations_cards_localized_with_english_fallback(service_with_cards, store):
    store.visited = [1, 2]
    loc = service_with_cards.list_locations(MATCH_UUID, "user-uuid", lang="it")[0]
    assert loc.card["title"] == "Sala iniziale"        # it text exists
    assert loc.card["description"] == "The start"      # falls back to en
    assert loc.neighbors[0].card["title"] == "Center"  # falls back to en


def test_list_locations_admin_resolves_cards(service_with_cards, store):
    store.match["id_user_creator"] = 999
    loc = service_with_cards.list_locations_for_admin(MATCH_UUID)[0]
    assert loc.card["uuid"] == "card-7"


def test_list_locations_card_none_when_id_card_missing(service_with_cards, store):
    store.locations[1]["id_card"] = None
    loc = service_with_cards.list_locations(MATCH_UUID, "user-uuid")[0]
    assert loc.card is None


def test_list_locations_card_none_without_story_read_port(service):
    loc = service.list_locations(MATCH_UUID, "user-uuid")[0]
    assert loc.card is None
    assert loc.neighbors[0].card is None
