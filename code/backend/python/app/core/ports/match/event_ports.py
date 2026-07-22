"""Step 29 — normal (player-triggered) event ports.

NOTE: not to be confused with ``app/core/ports/event`` — that is the domain-event
publisher (pub/sub), nothing to do with the events of a story.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.models.match.event_models import EventCheckContext, EventExecutionResult

# Marker every log_events row written by an executed event starts with.
#
# Load-bearing: the recovery (Step 26) and the weather engine (Step 27) already write
# log_events rows carrying an id_event for events that were never executed. Deciding "this
# ONCE event is spent" by scanning id_event alone would therefore consume events the player
# never triggered, so consumed_event_ids must be built from rows bearing this prefix only.
MSG_EVENT_EXECUTED = "EVENT_EXECUTED"

# Marker of a resolved choice-event cycle (Step 31 only READS it: a choice-event is "open"
# — serve the options again, charge nothing — while its EVENT_EXECUTED rows outnumber its
# CHOICE_SELECTED rows). Contract for Step 32, the first writer: the row's message starts
# with this prefix and its id_event column carries the OWNING EVENT id (not the choice id),
# so count_log_markers can pair the two markers by event.
MSG_CHOICE_SELECTED = "CHOICE_SELECTED"


class EventPort(ABC):
    @abstractmethod
    def execute_event(self, match_uuid: str, user_uuid: str, event_uuid: str,
                      lang: str = "en") -> EventExecutionResult:
        """Check, pay, apply the whole id_event_next chain, log."""


class EventStorePort(ABC):
    @abstractmethod
    def find_user_id_by_uuid(self, user_uuid: str) -> Optional[int]:
        ...

    @abstractmethod
    def find_match_for_event(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        """{id, uuid, status, current_clock, id_story, id_user_creator, id_current_weather}."""

    @abstractmethod
    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        """The actor: {id, uuid, id_user, id_class, id_location, dexterity, …, characteristics}."""

    @abstractmethod
    def find_characters_for_event(self, id_match: int) -> List[Dict[str, Any]]:
        """Every character of the match — recipient resolution for target=ALL (INV-27)."""

    @abstractmethod
    def find_backpack(self, id_match: int, id_character: int) -> Dict[str, int]:
        """{food, magic, coin}. Needed for EVERY recipient of a resource effect: the write
        touches all three columns, so starting from zero would silently wipe the others."""

    @abstractmethod
    def find_event_by_story_and_uuid(self, id_story: int,
                                     event_uuid: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_events_by_id(self, id_story: int) -> Dict[int, Dict[str, Any]]:
        """Every event of the story keyed by id — walks the chain in one read."""

    @abstractmethod
    def find_effects_by_event_id(self, id_story: int) -> Dict[int, List[Dict[str, Any]]]:
        """Effects grouped by id_event, each list ordered by effect id."""

    @abstractmethod
    def find_id_event_end_game(self, id_story: int) -> Optional[int]:
        ...

    @abstractmethod
    def find_id_event_all_player_coma(self, id_story: int) -> Optional[int]:
        """list_stories.id_event_all_player_coma — the Step 30 epilogue.

        None is legal: a story need not author one.
        """

    @abstractmethod
    def find_item_uuids_by_id(self, id_story: int) -> Dict[int, str]:
        ...

    @abstractmethod
    def find_trait_uuids_by_id(self, id_story: int) -> Dict[int, str]:
        ...

    @abstractmethod
    def find_location_uuids_by_id(self, id_story: int) -> Dict[int, str]:
        """Doubles as the existence check of a forced-movement effect (v0.29.3): an
        id_location absent from this map is authored noise and the move is skipped."""

    @abstractmethod
    def load_check_context(self, id_match: int,
                           id_character: Optional[int]) -> EventCheckContext:
        """Everything the check procedure needs, in ONE call (no N+1 on match-info)."""

    @abstractmethod
    def update_character_stats(self, id_match: int, id_character: int,
                               stats: Dict[str, int]) -> None:
        """dexterity, intelligence, constitution, energy, life, sad, exp."""

    @abstractmethod
    def update_backpack(self, id_match: int, id_character: int,
                        resources: Dict[str, int]) -> None:
        ...

    @abstractmethod
    def set_character_characteristics(self, id_match: int, id_character: int,
                                      csv: Optional[str]) -> None:
        ...

    @abstractmethod
    def add_item(self, id_match: int, id_character: int, id_item: int) -> None:
        ...

    @abstractmethod
    def remove_item(self, id_match: int, id_character: int, id_item: int) -> bool:
        """False when the character did not carry it."""

    @abstractmethod
    def add_trait(self, id_match: int, id_character: int, id_trait: int,
                  id_event: Optional[int]) -> bool:
        """False when the trait was already held."""

    @abstractmethod
    def remove_trait(self, id_match: int, id_character: int, id_trait: int) -> bool:
        ...

    @abstractmethod
    def upsert_registry(self, id_match: int, key: str, value: Optional[str],
                        id_character: Optional[int], id_event: Optional[int],
                        clock: int) -> None:
        ...

    @abstractmethod
    def set_current_weather(self, id_match: int, id_weather: Optional[int]) -> None:
        ...

    @abstractmethod
    def update_character_location(self, id_match: int, id_character: int,
                                  id_location: int) -> None:
        """Forced movement (v0.29.3): sets id_location, energy untouched."""

    @abstractmethod
    def insert_movement_log(self, id_match: int, id_character: int,
                            from_location: Optional[int], to_location: int,
                            energy_cost: int) -> None:
        """Forced movement writes it with cost 0, so the Step 28.7 timeline and the
        Step 28.6 visited set stay truthful."""

    @abstractmethod
    def log_event_executed(self, id_match: int, id_character: Optional[int], id_event: int,
                           clock: int, message: str) -> None:
        """Message MUST start with MSG_EVENT_EXECUTED — see that constant."""

    # ── choices (Step 31) ───────────────────────────────────────────────────

    @abstractmethod
    def find_choices_by_event_id(self, id_story: int, id_event: int) -> List[Dict[str, Any]]:
        """The event's list_choices rows; empty for a plain (Step 29) event.

        Canonical dict keys: id, uuid, id_event, id_card, priority, id_text_name,
        id_text_description, otherwise_flag, is_progress, logic_operator,
        limit_sad, limit_dex, limit_int, limit_cos.
        """

    @abstractmethod
    def find_choice_conditions_by_choice_id(self, id_story: int) -> Dict[int, List[Dict[str, Any]]]:
        """Every list_choices_conditions row grouped by id_choices, each list ordered by
        row id — one read no matter how many options the event has. Canonical dict keys:
        type, key, value, operator (the adapter maps its column names to these)."""

    @abstractmethod
    def count_log_markers(self, id_match: int, id_event: int, prefix: str) -> int:
        """How many log_events rows of the event carry a message starting with prefix —
        drives the open-cycle detection, see MSG_CHOICE_SELECTED."""

    @abstractmethod
    def find_trait_ids_by_character(self, id_match: int, id_character: int) -> set:
        """The story-local trait ids the character holds — the traits condition input."""

    @abstractmethod
    def resolve_short_text(self, id_story: int, id_text: Optional[int],
                           lang: str) -> Optional[str]:
        """The short text of id_text in lang, falling back to "en", None when absent."""
