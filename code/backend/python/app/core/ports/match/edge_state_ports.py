"""Step 30 — edge-state ports (sadness overflow, coma). Mirrors ``EdgeStateStorePort.java``.

A port of its own rather than three more methods on ``EventStorePort``, because two
unrelated services write these same rows: event execution and the Step 26 time-start
recovery. Each already owns a store port of its own, and neither should grow a copy of
these writes.

This port replaces ``EventStorePort.set_character_coma``, which raised the flags but never
recorded ``clock_in_coma``. That method was deleted rather than deprecated so the incomplete
write cannot survive anywhere.
"""
from abc import ABC, abstractmethod
from typing import Optional

# Sadness reached its cap: the character lost COS life and its sadness was reset.
#
# None of the three constants below may start with MSG_EVENT_EXECUTED: consumed_event_ids is
# built by scanning log_events for that prefix, so an edge-state row bearing it would
# silently consume a ONCE event the player never triggered.
MSG_SADNESS_OVERFLOW = "SADNESS_OVERFLOW"

# Life hit zero: the character entered coma.
MSG_COMA = "COMA"

# Every character of the match is now comatose.
#
# Note that this value *contains* MSG_COMA: match these messages with ``startswith``, never
# with ``in``, or a party row reads as a personal one.
MSG_ALL_PLAYER_COMA = "ALL_PLAYER_COMA"


class EdgeStateStorePort(ABC):

    @abstractmethod
    def set_coma(self, id_match: int, id_character: int, clock_in_coma: int) -> None:
        """is_coma = True, is_sleeping = True and clock_in_coma = clock_in_coma.

        Callers must not invoke this for a character already in coma, or the clock of the
        original collapse is overwritten and the value stops meaning anything.
        """

    @abstractmethod
    def set_sleeping(self, id_match: int, id_character: int) -> None:
        """Raise is_sleeping alone — a sadness overflow forces sleep without coma."""

    @abstractmethod
    def log_edge_state(self, id_match: int, id_character: Optional[int],
                       id_event: Optional[int], clock: int, message: str) -> None:
        """Append a log_events row.

        ``id_character`` and ``id_event`` are both nullable: the recovery path has no
        triggering event, and the all-players-in-coma row belongs to the match rather than
        to any one character.
        """
