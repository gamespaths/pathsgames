"""Step 25 — time advancement & clock cycle service (mirrors the Java reference).

Adds a voluntary sleep action and a clock query, and advances the match clock
when every active character is "done" (sleeping or out of energy — in
single-player the list is size 1). On time-end it logs the advance, wakes the
characters, rebuilds ``gaming_turn_queue`` reusing the Step 24 priority formula,
and publishes a ``TimeAdvanced`` event.
"""
from typing import Any, Dict, List

from app.core.models.match import match_statuses
from app.core.models.match import turn_models as tm
from app.core.models.match.time_models import (
    ClockCharacter,
    ClockResult,
    RecoveryItem,
    SleepResult,
    TimeAdvanced,
)
from app.core.models.match.turn_models import TurnCycleError
from app.core.ports.event.event_ports import DomainEventPublisher
from app.core.ports.match.time_ports import TimeAdvancementPort, TimeStorePort
from app.core.services.match.time_start_recovery_service import TimeStartRecoveryService

DEFAULT_LANG = "en"


class TimeAdvancementService(TimeAdvancementPort):
    def __init__(self, store: TimeStorePort, event_publisher: DomainEventPublisher,
                 recovery_service: "TimeStartRecoveryService | None" = None,
                 weather_service=None, edge_store=None) -> None:
        self.store = store
        self.event_publisher = event_publisher
        self.recovery_service = recovery_service or TimeStartRecoveryService(store, edge_store)
        # Step 27 — optional weather selection engine (may be None in tests).
        self.weather_service = weather_service
        # Step 33 — the engine that runs the automatic events a time-start collected.
        # Injected through a setter rather than the constructor, and deliberately so: the
        # runner is EventService, which already depends on this service for
        # force_time_end. Constructor injection either way would be a cycle; the setter
        # closes the loop once, at wiring time. None is a legal state — every test that
        # builds this service directly then behaves exactly as before Step 33.
        self.automatic_event_runner = None

    def set_automatic_event_runner(self, runner) -> None:
        """Step 33 — see ``automatic_event_runner``. Called once, from the wiring."""
        self.automatic_event_runner = runner

    # ── public API ──────────────────────────────────────────────────────────

    def sleep(self, match_uuid: str, user_uuid: str) -> SleepResult:
        user_id = self._require_user(user_uuid)
        match = self._require_match(match_uuid)

        # The caller must own a character in this match (mask as not-found otherwise).
        caller = self.store.find_character_by_match_and_user(match["id"], user_id)
        if caller is None:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_FOUND, "Match not found or not accessible")

        if match["status"] != match_statuses.RUNNING:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_RUNNING, "Match is not RUNNING")

        # Idempotent: setting sleeping on an already-sleeping character is a no-op effect.
        self.store.set_character_sleeping(match["id"], caller["id"], True)
        # Step 28.7 — log the sleep action for the match logs timeline.
        self.store.log_sleep(match["id"], caller["id"], match.get("current_clock") or 0)

        # Re-read so the trigger sees the just-applied sleep flag.
        characters = self.store.find_characters_by_match_id(match["id"]) or []
        triggered = self._all_done(characters)

        current_clock = match["current_clock"]
        recovery: List[RecoveryItem] = []
        counter_zero: List[Any] = []
        if triggered:
            current_clock, recovery, fired = self._advance_time(match)
            # Step 33 — the same events, told to THIS player. The caller is the only
            # recipient with an open request; the rest learn about it over the WebSocket
            # once Steps 49-54 land, through this very method called once per player.
            counter_zero = self._describe_counter_zero(match["id"], caller["id"], fired,
                                                       current_clock)

        # After a time-end every character is awake again; otherwise the caller stays asleep.
        return SleepResult(match_uuid, caller["uuid"], not triggered, triggered,
                           current_clock, recovery, counter_zero)

    def clock(self, match_uuid: str, user_uuid: str) -> ClockResult:
        user_id = self._require_user(user_uuid)
        match = self._require_owned_match(match_uuid, user_id)

        characters = self.store.find_characters_by_match_id(match["id"]) or []
        singular, plural = self.store.find_story_clock_labels(match["id"], DEFAULT_LANG)

        chars: List[ClockCharacter] = []
        any_sleeping = False
        for c in characters:
            sleeping = bool(c.get("is_sleeping"))
            any_sleeping = any_sleeping or sleeping
            chars.append(ClockCharacter(c["uuid"], sleeping, c.get("energy", 0) or 0))
        return ClockResult(match_uuid, match["current_clock"], singular, plural,
                           any_sleeping, chars)

    # ── time-end ──────────────────────────────────────────────────────────────

    @staticmethod
    def _all_done(characters: List[Dict[str, Any]]) -> bool:
        """Time-end trigger: every character is sleeping OR out of energy.
        In single-player the list is size 1. An empty list never triggers."""
        if not characters:
            return False
        for c in characters:
            done = bool(c.get("is_sleeping")) or (c.get("energy", 0) or 0) <= 0
            if not done:
                return False
        return True

    def force_time_end(self, match_uuid: str) -> int:
        """Step 29 — force a time end: put every character to sleep, then advance.

        Exposed on the class and deliberately NOT on TimeAdvancementPort: nothing over REST
        should be able to skip a time unit, only the engine. Note that _advance_time wakes
        everybody right after, so the net observable state is "awake at clock+1"; the
        forced_sleep flag the event returns records the transition.
        """
        match = self._require_match(match_uuid)
        self.store.set_all_characters_sleeping(match["id"])
        new_clock, _recovery, _fired = self._advance_time(match)
        return new_clock

    def _advance_time(self, match: Dict[str, Any]):
        new_clock = self.store.increment_match_clock(match["id"])
        self.store.insert_clock_history(match["id"], new_clock)
        self.store.wake_all_characters(match["id"])
        # Step 26: per-character recovery, class bonuses and location counters.
        outcome = self.recovery_service.apply_at_time_start(match["id"])
        # Step 33: the events that pass collected — counters that reached zero, and the
        # locations whose id_event_if_character_start_time fires because a time unit began
        # with somebody standing there. Run here rather than inside the recovery service:
        # the event engine sits above it in the wiring, and an event can force a time end.
        fired: List[Any] = []
        if self.automatic_event_runner is not None and outcome.pending:
            fired = self.automatic_event_runner.run_pending_automatic_events(
                match["id"], new_clock, outcome.pending, DEFAULT_LANG)
        # Step 27: select the weather for the new time unit and apply its delta.
        if self.weather_service is not None:
            self.weather_service.apply_at_time_start(match["id"])
        self._rebuild_queue(match["id"], new_clock)
        self.event_publisher.publish(TimeAdvanced(match["uuid"], new_clock))
        return new_clock, outcome.recovery, fired

    def _describe_counter_zero(self, id_match: int, id_recipient_character,
                               fired: List[Any], clock: int) -> List[Any]:
        """Apply the per-recipient fog-of-war rule to an already-run list.

        No runner (a unit test that built this service directly) means no automatic events
        ran in the first place, so the list is empty either way.
        """
        if self.automatic_event_runner is None or not fired:
            return []
        return self.automatic_event_runner.describe_for_recipient(
            id_match, id_recipient_character, clock, fired, DEFAULT_LANG)

    def _rebuild_queue(self, id_match: int, clock: int) -> None:
        characters = self.store.find_characters_by_match_id(id_match) or []
        if not characters:
            self.store.replace_queue(id_match, [])
            self.store.update_match_status_and_turn(id_match, match_statuses.RUNNING, None)
            return
        rows: List[Dict[str, Any]] = []
        for c in characters:
            priority = tm.compute_priority(c["dexterity"], c["intelligence"],
                                           c["constitution"], c["life"], c["id"])
            rows.append({
                "id_character_match": c["id"], "clock": clock, "priority": priority,
                "status": tm.WAITING, "pass_counter": 0,
                "timestamp_start": None, "timestamp_end": None,
            })
        rows.sort(key=lambda r: r["priority"], reverse=True)
        rows[0]["status"] = tm.ACTIVE
        self.store.replace_queue(id_match, rows)
        self.store.update_match_status_and_turn(id_match, match_statuses.RUNNING,
                                                rows[0]["id_character_match"])

    # ── helpers ───────────────────────────────────────────────────────────────

    def _require_user(self, user_uuid: str) -> int:
        user_id = self.store.find_user_id_by_uuid(user_uuid)
        if user_id is None:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_FOUND, "Match not found or not accessible")
        return user_id

    def _require_match(self, match_uuid: str) -> Dict[str, Any]:
        match = self.store.find_match_by_uuid(match_uuid)
        if match is None:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_FOUND, "Match not found or not accessible")
        return match

    def _require_owned_match(self, match_uuid: str, user_id: int) -> Dict[str, Any]:
        match = self._require_match(match_uuid)
        if match["id_user_creator"] != user_id:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_FOUND, "Match not found or not accessible")
        return match
