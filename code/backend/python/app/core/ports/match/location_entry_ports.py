"""Step 33 — outbound port for the location engine (mirrors the Java reference).

Deliberately narrow: the trigger resolution needs the location's five ``id_event_*``
columns, the ``flag_visited`` latch, who else is standing where, and one audit row.
Everything else it does — running the event, applying the effects — goes through the
existing ``EventStorePort``.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class LocationEntryStorePort(ABC):

    @abstractmethod
    def find_location_triggers(self, id_story: int,
                               id_location: int) -> Optional[Dict[str, Any]]:
        """The trigger columns of one story location, or None when it is unknown.

        ``{id_location, id_card, id_event_if_first_time, id_event_not_first_time,
        id_event_if_character_enter_first_time, id_event_if_character_start_time,
        id_event_if_counter_zero, priority_automatic_event}``. All nullable: a null column
        is simply not a trigger.
        """

    @abstractmethod
    def find_flag_visited(self, id_match: int, id_location: int) -> int:
        """``gaming_state_locations.flag_visited`` for this (match, location).

        Returns 0 when no row exists — a location nobody has been to."""

    @abstractmethod
    def mark_state_location_visited(self, id_match: int, id_location: int) -> None:
        """Latch the location as visited by the party. Idempotent."""

    @abstractmethod
    def count_other_characters_at_location(self, id_match: int, id_location: int,
                                           except_id_character: int) -> int:
        """How many characters stand here other than ``except_id_character``.

        Zero is what makes an arrival FIRST_IN_LOCATION."""

    @abstractmethod
    def find_nominal_actor_at_location(self, id_match: int,
                                       id_location: int) -> Optional[int]:
        """The lowest-id character standing here, or None when nobody is.

        This is the nominal actor of a counter-zero event: the fuse belongs to the
        location, but the effects still need somebody to resolve ``target = ONLY_ONE``
        against, and ``target = ALL`` then means everyone in that location — never the
        whole match."""

    @abstractmethod
    def log_automatic_event(self, id_match: int, id_character: Optional[int],
                            id_location: int, id_event: Optional[int],
                            clock: Optional[int], message: str) -> None:
        """Append the ``log_events`` audit row for an automatic event."""

    @abstractmethod
    def find_visited_location_ids(self, id_match: int) -> List[int]:
        """The locations the party has ever been to — current positions plus every endpoint
        in ``log_movements``. The same set Step 28 derives for fog of war, and what decides
        whether a counter-zero notice may name the place it happened in."""

    @abstractmethod
    def find_character_location(self, id_match: int,
                               id_character: int) -> Optional[int]:
        """Where a character stands, for the FULL visibility case."""
