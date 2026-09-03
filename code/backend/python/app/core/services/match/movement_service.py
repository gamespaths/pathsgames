"""Step 28 — movement system service (mirrors the Java reference).

Moves the caller's active character to an adjacent location. The energy paid
combines the edge cost, the target location entry cost and the Step 27 weather
modifier (different for safe vs unsafe locations):

    safe            = target.secure_param > 0
    weather_modifier = safe ? weather.cost_safe : weather.cost_not_safe
    total_energy_cost = edge.energy_cost + target.cost_energy_enter + weather_modifier

Scope (Step 28): the move + energy. **Step 33** hung the automatic location-entry
events off the end of it — the destination's ``id_event_*`` columns, resolved once the
move is committed and returned in ``automatic_events``. Group/follow movement and
concurrent locking are Step 67; the full weight/capacity formula is Step 34 (carried
weight is 0 until inventory lands).
"""
from typing import Any, Dict, List, Optional

from app.core.models.match import match_statuses
from app.core.models.match.event_models import EdgeStateOutcome
from app.core.models.match.location_entry_models import ArrivalContext
from app.core.models.match.movement_models import (
    MovementError,
    MovementResult,
    NeighborCost,
    VisitedLocation,
)
from app.core.ports.match.movement_ports import MovementPort, MovementStorePort
from app.core.services.match import movement_availability
from app.core.services.match.movement_availability import MoveCheckContext, MoveEdgeCheck
from app.core.services.match import registry_service


def move_check_context(match: Dict[str, Any],
                       caller: Optional[Dict[str, Any]]) -> MoveCheckContext:
    """The mover's edge-independent state, as ``movement_availability.check`` wants it.

    Shared with ``MatchQueryService``, which reports the same verdict on every neighbor of
    match-info: one reading of the character, one meaning.
    """
    if caller is None:
        return MoveCheckContext.no_character()
    return MoveCheckContext(
        match_running=match.get("status") == match_statuses.RUNNING,
        has_character=True,
        coma=bool(caller.get("is_coma")),
        sleeping=bool(caller.get("is_sleeping")),
        energy=caller.get("energy") or 0,
        # Step 35 — the real Sigma (item.weight x amount), computed by the store adapter.
        carried_weight=caller.get("carried_weight") or 0,
        weight_max=caller.get("weight_max") or 0,
        # v0.35.3 — the backpack, for the edge resource costs.
        food=caller.get("food") or 0,
        magic=caller.get("magic") or 0,
        coin=caller.get("coin") or 0,
    )


# The player-facing message for a refused move; the CODE is what clients switch on.
_REASON_MESSAGES = {
    MovementError.MATCH_NOT_RUNNING: "Match is not RUNNING",
    MovementError.COMA: "Character cannot move while in coma",
    MovementError.SLEEPING: "Character cannot move while sleeping",
    MovementError.MOVEMENT_CONDITION_NOT_MET: "Movement condition not met",
    MovementError.OVERWEIGHT: "Carried weight exceeds capacity",
    MovementError.INSUFFICIENT_ENERGY: "Not enough energy",
    MovementError.LOCATION_FULL: "Target location is at capacity",
    MovementError.CHARACTER_CANNOT_ACT: "Character cannot act",
}


def _reason_message(code: str) -> str:
    return _REASON_MESSAGES.get(code, "Movement refused")


class MovementService(MovementPort):
    def __init__(self, store: MovementStorePort, story_read_port=None,
                 location_entry=None, registry_service_instance=None) -> None:
        # ``story_read_port`` (StoryMatchReadPort) resolves the location cards;
        # optional so legacy wiring keeps working (cards stay None without it).
        self.store = store
        self.story_read_port = story_read_port
        # Step 33 — the location engine. None keeps the pre-33 behaviour: a move fires
        # nothing.
        self.location_entry = location_entry
        # Step 36 — every registry read of a move condition goes through it.
        self.registry_service = registry_service_instance

    # ── public API ──────────────────────────────────────────────────────────

    def start_movement(self, match_uuid: str, user_uuid: str,
                       target_location_uuid: str) -> MovementResult:
        user_id = self._require_user(user_uuid)
        match = self._require_match(match_uuid)

        caller = self.store.find_character_by_match_and_user(match["id"], user_id)
        if caller is None:
            raise MovementError(MovementError.MATCH_NOT_FOUND, "Match not found or not accessible")

        # The mover's own state (match RUNNING, coma, sleep) is judged before the target is
        # even resolved, so an asleep player is told they are asleep rather than that their
        # destination is not a neighbor. Passing edge=None asks the checker for exactly that
        # prefix of the verdict; NOT_A_NEIGHBOR is its way of saying "so far so good, now
        # give me an edge", and this call is not the one that decides it.
        ctx = move_check_context(match, caller)
        pre = movement_availability.check(ctx, None)
        if not pre.available and pre.reason != MovementError.NOT_A_NEIGHBOR:
            raise MovementError(pre.reason, _reason_message(pre.reason))

        if caller.get("id_location") is None:
            raise MovementError(MovementError.NOT_A_NEIGHBOR, "Character has no current location")

        target = self.store.find_location_by_uuid(match["id_story"], target_location_uuid)
        if target is None:
            raise MovementError(MovementError.NOT_A_NEIGHBOR, "Target location is not a neighbor")

        edge = self._find_edge(match["id_story"], caller["id_location"], target["id"])
        if edge is None:
            raise MovementError(MovementError.NOT_A_NEIGHBOR, "Target location is not a neighbor")

        total_cost = self._total_cost(edge["energy_cost"], target,
                                      self.store.find_current_weather_move_cost(match["id"]))

        max_chars = target.get("max_characters") or 0
        verdict = movement_availability.check(ctx, MoveEdgeCheck(
            condition_met=self._condition_met(match["id"], edge),
            total_energy_cost=total_cost,
            max_characters=max_chars,
            characters_at_target=(
                self.store.count_characters_at_location(match["id"], target["id"])
                if max_chars > 0 else 0),
            cost_food=edge.get("cost_food") or 0,
            cost_magic=edge.get("cost_magic") or 0,
            cost_coin=edge.get("cost_coin") or 0,
        ))
        if not verdict.available:
            raise MovementError(verdict.reason, _reason_message(verdict.reason))

        cost_food = edge.get("cost_food") or 0
        cost_magic = edge.get("cost_magic") or 0
        cost_coin = edge.get("cost_coin") or 0

        new_energy = (caller.get("energy", 0) or 0) - total_cost
        # v0.35.3 — the checker proved the mover can afford all four, so none goes below 0.
        new_food = (caller.get("food") or 0) - cost_food
        new_magic = (caller.get("magic") or 0) - cost_magic
        new_coin = (caller.get("coin") or 0) - cost_coin
        self.store.update_character_location_and_energy(
            match["id"], caller["id"], target["id"], new_energy)
        if cost_food or cost_magic or cost_coin:
            self.store.update_backpack_resources(
                match["id"], caller["id"], new_food, new_magic, new_coin)
        self.store.insert_movement_log(
            match["id"], caller["id"], caller["id_location"], target["id"], total_cost,
            cost_food, cost_magic, cost_coin)

        # Step 33 — the move is committed, so the arrival is real: ask the destination what
        # it does about somebody walking in. Deliberately after both writes, because the
        # trigger resolution reads the character's new position back.
        automatic_events = []
        if self.location_entry is not None:
            automatic_events = self.location_entry.on_arrival(ArrivalContext(
                id_match=match["id"],
                id_story=match["id_story"],
                id_character=caller["id"],
                id_location=target["id"],
                current_clock=match["current_clock"],
                lang=None,
            ))

        # v0.35.6 — one Step 30 verdict for the whole arrival: several automatic events can
        # fire on one entry and any of them can kill, so the move answers a single edge state.
        edge_state = EdgeStateOutcome.merge([f.edge_state for f in automatic_events])
        return MovementResult(match_uuid, caller["uuid"], caller["id_location"], None,
                              target["id"], target.get("uuid"), total_cost, new_energy,
                              match["current_clock"],
                              automatic_events=automatic_events,
                              food_spent=cost_food, magic_spent=cost_magic,
                              coin_spent=cost_coin, new_food=new_food,
                              new_magic=new_magic, new_coin=new_coin,
                              edge_state=edge_state)

    def list_locations(self, match_uuid: str, user_uuid: str,
                       lang: str = "en") -> List[VisitedLocation]:
        user_id = self._require_user(user_uuid)
        match = self._require_match(match_uuid)
        if match["id_user_creator"] != user_id:
            raise MovementError(MovementError.MATCH_NOT_FOUND, "Match not found or not accessible")
        return self._build_locations(match, lang)

    def list_locations_for_admin(self, match_uuid: str,
                                 lang: str = "en") -> List[VisitedLocation]:
        return self._build_locations(self._require_match(match_uuid), lang)

    # ── visited locations payload ─────────────────────────────────────────────

    def _build_locations(self, match: Dict[str, Any],
                         lang: str = "en") -> List[VisitedLocation]:
        visited = self.store.find_visited_location_ids(match["id"])
        # Fog of war (v0.28.6): a neighbor pointing at a never-visited location
        # must not expose that location's card.
        visited_set = set(visited)
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
                # Hide the neighbor's LOCATION card (idCard + card) until that
                # location has been visited.
                other_visited = other["id"] in visited_set
                neighbor_id_card = other.get("id_card") if other_visited else None
                neighbors.append(NeighborCost(other["id"], other.get("uuid"),
                                              edge.get("direction"), base, entry, weather_mod,
                                              base + entry + weather_mod,
                                              self._condition_met(match["id"], edge),
                                              cost_food=edge.get("cost_food") or 0,
                                              cost_magic=edge.get("cost_magic") or 0,
                                              cost_coin=edge.get("cost_coin") or 0,
                                              id_card=neighbor_id_card,
                                              card=self._resolve_card(match["id_story"],
                                                                      neighbor_id_card, lang),
                                              id_location_from=edge.get("id_from"),
                                              id_location_to=edge.get("id_to")))
            result.append(VisitedLocation(loc["id"], loc.get("uuid"), loc.get("id_card"),
                                          (loc.get("secure_param") or 0) > 0, count, neighbors,
                                          card=self._resolve_card(match["id_story"],
                                                                  loc.get("id_card"), lang)))
        return result

    # ── card resolution (mirrors MatchQueryService._resolve_card) ────────────

    def _resolve_card(self, story_id, id_card, lang="en"):
        """Resolve an ``id_card`` reference to a camelCase card dict mirroring
        CardInfoResponse, or None. Card text falls back to English."""
        if id_card is None or self.story_read_port is None:
            return None
        card = self.story_read_port.find_card_by_story_id_and_card_id(story_id, id_card)
        if card is None:
            return None
        title_id = card.get("id_text_title") or card.get("id_text_name")
        return {
            "uuid": card.get("uuid"),
            "cardType": card.get("card_type"),
            "urlImage": card.get("url_image"),
            "alternativeImage": card.get("alternative_image"),
            "awesomeIcon": card.get("awesome_icon"),
            "styleMain": card.get("style_main"),
            "styleDetail": card.get("style_detail"),
            "styleImageLittle": card.get("style_image_little"),
            "styleImageMedium": card.get("style_image_medium"),
            "styleImageLarge": card.get("style_image_large"),
            "title": self._resolve_card_text(story_id, title_id, lang),
            "description": self._resolve_card_text(story_id, card.get("id_text_description"), lang),
            "copyrightText": self._resolve_card_text(story_id, card.get("id_text_copyright"), lang),
            "linkCopyright": card.get("link_copyright"),
        }

    def _resolve_card_text(self, story_id, id_text, lang):
        """Resolve a localized text by id_text, falling back to English."""
        if id_text is None:
            return None
        effective = lang if lang and lang.strip() else "en"
        text = self.story_read_port.find_text_by_story_id_text_and_lang(story_id, id_text, effective)
        if text:
            return text.get("short_text")
        if effective != "en":
            fallback = self.story_read_port.find_text_by_story_id_text_and_lang(story_id, id_text, "en")
            if fallback:
                return fallback.get("short_text")
        return None

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
        if registry_service.no_condition(key):
            return True
        value = self.registry_service.find(id_match, key)
        return registry_service.evaluate(edge.get("registry_value_operator_condition"),
                                         edge.get("condition_value"), value)

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
