"""Step 28 — movement system service (mirrors the Java reference).

Moves the caller's active character to an adjacent location. The energy paid
combines the edge cost, the target location entry cost and the Step 27 weather
modifier (different for safe vs unsafe locations):

    safe            = target.secure_param > 0
    weather_modifier = safe ? weather.cost_safe : weather.cost_not_safe
    total_energy_cost = edge.energy_cost + target.cost_energy_enter + weather_modifier

Scope (Step 28): only the move + energy. Automatic location-entry events are
Step 32; group/follow movement and concurrent locking are Step 67; the full
weight/capacity formula is Step 34 (carried weight is 0 until inventory lands).
"""
from typing import Any, Dict, List, Optional

from app.core.models.match import match_statuses
from app.core.models.match.movement_models import (
    MovementError,
    MovementResult,
    NeighborCost,
    VisitedLocation,
)
from app.core.ports.match.movement_ports import MovementPort, MovementStorePort


class MovementService(MovementPort):
    def __init__(self, store: MovementStorePort) -> None:
        self.store = store

    # ── public API ──────────────────────────────────────────────────────────

    def start_movement(self, match_uuid: str, user_uuid: str,
                       target_location_uuid: str) -> MovementResult:
        user_id = self._require_user(user_uuid)
        match = self._require_match(match_uuid)

        caller = self.store.find_character_by_match_and_user(match["id"], user_id)
        if caller is None:
            raise MovementError(MovementError.MATCH_NOT_FOUND, "Match not found or not accessible")

        if match["status"] != match_statuses.RUNNING:
            raise MovementError(MovementError.MATCH_NOT_RUNNING, "Match is not RUNNING")
        if caller.get("is_sleeping") or caller.get("is_coma"):
            raise MovementError(MovementError.CHARACTER_CANNOT_ACT,
                                "Character cannot move while sleeping or in coma")
        if caller.get("id_location") is None:
            raise MovementError(MovementError.NOT_A_NEIGHBOR, "Character has no current location")

        target = self.store.find_location_by_uuid(match["id_story"], target_location_uuid)
        if target is None:
            raise MovementError(MovementError.NOT_A_NEIGHBOR, "Target location is not a neighbor")

        edge = self._find_edge(match["id_story"], caller["id_location"], target["id"])
        if edge is None:
            raise MovementError(MovementError.NOT_A_NEIGHBOR, "Target location is not a neighbor")

        if not self._condition_met(match["id"], edge):
            raise MovementError(MovementError.MOVEMENT_CONDITION_NOT_MET,
                                "Movement condition not met")

        total_cost = self._total_cost(edge["energy_cost"], target,
                                      self.store.find_current_weather_move_cost(match["id"]))

        if (caller.get("carried_weight", 0) or 0) > (caller.get("weight_max", 0) or 0):
            raise MovementError(MovementError.OVERWEIGHT, "Carried weight exceeds capacity")
        if (caller.get("energy", 0) or 0) < total_cost:
            raise MovementError(MovementError.INSUFFICIENT_ENERGY, "Not enough energy")

        max_chars = target.get("max_characters") or 0
        if max_chars > 0 and self.store.count_characters_at_location(
                match["id"], target["id"]) >= max_chars:
            raise MovementError(MovementError.LOCATION_FULL, "Target location is at capacity")

        new_energy = (caller.get("energy", 0) or 0) - total_cost
        self.store.update_character_location_and_energy(
            match["id"], caller["id"], target["id"], new_energy)
        self.store.insert_movement_log(
            match["id"], caller["id"], caller["id_location"], target["id"], total_cost)

        return MovementResult(match_uuid, caller["uuid"], caller["id_location"], None,
                              target["id"], target.get("uuid"), total_cost, new_energy,
                              match["current_clock"])

    def list_locations(self, match_uuid: str, user_uuid: str) -> List[VisitedLocation]:
        user_id = self._require_user(user_uuid)
        match = self._require_match(match_uuid)
        if match["id_user_creator"] != user_id:
            raise MovementError(MovementError.MATCH_NOT_FOUND, "Match not found or not accessible")
        return self._build_locations(match)

    def list_locations_for_admin(self, match_uuid: str) -> List[VisitedLocation]:
        return self._build_locations(self._require_match(match_uuid))

    # ── visited locations payload ─────────────────────────────────────────────

    def _build_locations(self, match: Dict[str, Any]) -> List[VisitedLocation]:
        visited = self.store.find_visited_location_ids(match["id"])
        characters = self.store.find_characters_for_movement(match["id"])
        weather = self.store.find_current_weather_move_cost(match["id"])

        result: List[VisitedLocation] = []
        for loc_id in visited:
            loc = self.store.find_location_by_id(match["id_story"], loc_id)
            if loc is None:
                continue
            count = sum(1 for c in characters if c.get("id_location") == loc["id"])
            neighbors: List[NeighborCost] = []
            for edge in self.store.find_neighbors_of_location(match["id_story"], loc["id"]):
                # One-way link (flag_back=NO): not offered as a way back when
                # standing on the destination endpoint.
                if not self._traversable_from(edge, loc["id"]):
                    continue
                other_id = self._other_endpoint(edge, loc["id"])
                other = self.store.find_location_by_id(match["id_story"], other_id)
                if other is None:
                    continue
                cost_safe, cost_not_safe = weather if weather else (0, 0)
                base = edge["energy_cost"] or 0
                entry = other.get("cost_energy_enter") or 0
                weather_mod = cost_safe if (other.get("secure_param") or 0) > 0 else cost_not_safe
                neighbors.append(NeighborCost(other["id"], other.get("uuid"),
                                              edge.get("direction"), base, entry, weather_mod,
                                              base + entry + weather_mod,
                                              self._condition_met(match["id"], edge)))
            result.append(VisitedLocation(loc["id"], loc.get("uuid"), loc.get("id_card"),
                                          (loc.get("secure_param") or 0) > 0, count, neighbors))
        return result

    # ── helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _total_cost(edge_cost: int, target: Dict[str, Any], weather) -> int:
        cost_safe, cost_not_safe = weather if weather else (0, 0)
        weather_modifier = cost_safe if (target.get("secure_param") or 0) > 0 else cost_not_safe
        return (edge_cost or 0) + (target.get("cost_energy_enter") or 0) + weather_modifier

    def _find_edge(self, id_story: int, from_location: int,
                   to_location: int) -> Optional[Dict[str, Any]]:
        for e in self.store.find_neighbors_of_location(id_story, from_location):
            # Block backward traversal of a one-way link (flag_back=NO).
            if self._touches(e, from_location, to_location) and self._traversable_from(e, from_location):
                return e
        return None

    @staticmethod
    def _touches(e: Dict[str, Any], a: int, b: int) -> bool:
        return (e["id_from"] == a and e["id_to"] == b) or (e["id_from"] == b and e["id_to"] == a)

    @staticmethod
    def _traversable_from(e: Dict[str, Any], loc_id: int) -> bool:
        """Forward (loc_id == id_from) always allowed; backward (loc_id == id_to)
        only when ``flag_back == 1`` (a two-way link)."""
        if e["id_from"] == loc_id:
            return True
        return e["id_to"] == loc_id and (e.get("flag_back") or 0) == 1

    @staticmethod
    def _other_endpoint(e: Dict[str, Any], loc_id: int) -> int:
        return e["id_to"] if e["id_from"] == loc_id else e["id_from"]

    def _condition_met(self, id_match: int, edge: Dict[str, Any]) -> bool:
        key = edge.get("condition_key")
        if not key:
            return True
        value = self.store.find_registry_value(id_match, key)
        return edge.get("condition_value") is not None and edge["condition_value"] == value

    def _require_user(self, user_uuid: str) -> int:
        user_id = self.store.find_user_id_by_uuid(user_uuid)
        if user_id is None:
            raise MovementError(MovementError.MATCH_NOT_FOUND, "Match not found or not accessible")
        return user_id

    def _require_match(self, match_uuid: str) -> Dict[str, Any]:
        match = self.store.find_match_for_movement(match_uuid)
        if match is None:
            raise MovementError(MovementError.MATCH_NOT_FOUND, "Match not found or not accessible")
        return match
