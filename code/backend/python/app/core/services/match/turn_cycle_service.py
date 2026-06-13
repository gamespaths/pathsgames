"""Step 24 — single-player turn cycle service (mirrors the Java reference)."""
from typing import Any, Dict, List, Optional

from app.core.models.match import match_statuses
from app.core.models.match import turn_models as tm
from app.core.models.match.turn_models import (
    PassResult,
    TurnCycleError,
    TurnEntry,
    TurnSequenceResult,
)
from app.core.ports.match.turn_ports import TurnCyclePort, TurnCycleStorePort


class TurnCycleService(TurnCyclePort):
    def __init__(self, store: TurnCycleStorePort) -> None:
        self.store = store

    # ── public API ──────────────────────────────────────────────────────────

    def start_match(self, match_uuid: str, user_uuid: str) -> TurnSequenceResult:
        user_id = self._require_user(user_uuid)
        match = self._require_owned_match(match_uuid, user_id)

        if match["status"] != match_statuses.CREATED:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_STARTABLE, "Match is not in CREATED state")

        characters = self.store.find_characters_by_match_id(match["id"]) or []
        if not characters:
            raise TurnCycleError(TurnCycleError.NO_CHARACTERS_JOINED, "No character has joined the match")

        rows: List[Dict[str, Any]] = []
        for c in characters:
            priority = tm.compute_priority(c["dexterity"], c["intelligence"],
                                           c["constitution"], c["life"], c["id"])
            rows.append({
                "id_character_match": c["id"], "clock": match["current_clock"],
                "priority": priority, "status": tm.WAITING, "pass_counter": 0,
                "timestamp_start": None, "timestamp_end": None,
            })
        rows.sort(key=lambda r: r["priority"], reverse=True)
        rows[0]["status"] = tm.ACTIVE

        self.store.replace_queue(match["id"], rows)
        top_id = rows[0]["id_character_match"]
        self.store.update_match_status_and_turn(match["id"], match_statuses.RUNNING, top_id)

        return self._build_sequence(match_uuid, match["current_clock"],
                                    match_statuses.RUNNING, top_id, rows, characters)

    def pass_turn(self, match_uuid: str, user_uuid: str) -> PassResult:
        user_id = self._require_user(user_uuid)
        match = self._require_owned_match(match_uuid, user_id)

        if match["status"] != match_statuses.RUNNING:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_RUNNING, "Match is not RUNNING")

        characters = self.store.find_characters_by_match_id(match["id"]) or []
        by_id = {c["id"]: c for c in characters}
        rows = self._sorted(self.store.find_queue_by_match_id(match["id"]) or [])

        active = next((r for r in rows if r["status"] == tm.ACTIVE), None)
        if active is None and match.get("id_character_current_turn") is not None:
            active = next((r for r in rows if r["id_character_match"] == match["id_character_current_turn"]), None)
        if active is None:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_RUNNING, "No active turn to pass")

        active_char = by_id.get(active["id_character_match"])
        if active_char is None or active_char["id_user"] != user_id:
            raise TurnCycleError(TurnCycleError.NOT_YOUR_TURN, "It is not your character's turn")

        # Complete the current turn.
        active["status"] = tm.COMPLETED
        active["pass_counter"] = active.get("pass_counter", 0) + 1
        active["timestamp_start"] = None
        active["timestamp_end"] = None
        self.store.save_queue_row(match["id"], active)

        # Next WAITING; if none, start a new round (reset all to WAITING).
        nxt = self._highest_waiting(rows)
        if nxt is None:
            for r in rows:
                r["status"] = tm.WAITING
                r["timestamp_start"] = None
                r["timestamp_end"] = None
                self.store.save_queue_row(match["id"], r)
            nxt = self._highest_waiting(rows)

        nxt["status"] = tm.ACTIVE
        nxt["timestamp_start"] = None
        self.store.save_queue_row(match["id"], nxt)
        self.store.update_match_status_and_turn(match["id"], match_statuses.RUNNING,
                                                nxt["id_character_match"])

        return PassResult(match_uuid,
                          self._char_uuid(by_id, active["id_character_match"]),
                          self._char_uuid(by_id, nxt["id_character_match"]),
                          match_statuses.RUNNING)

    def get_turn_sequence(self, match_uuid: str, user_uuid: str) -> TurnSequenceResult:
        user_id = self._require_user(user_uuid)
        match = self._require_owned_match(match_uuid, user_id)
        characters = self.store.find_characters_by_match_id(match["id"]) or []
        rows = self._sorted(self.store.find_queue_by_match_id(match["id"]) or [])
        return self._build_sequence(match_uuid, match["current_clock"], match["status"],
                                    match.get("id_character_current_turn"), rows, characters)

    # ── helpers ─────────────────────────────────────────────────────────────

    def _require_user(self, user_uuid: str) -> int:
        user_id = self.store.find_user_id_by_uuid(user_uuid)
        if user_id is None:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_FOUND, "Match not found or not accessible")
        return user_id

    def _require_owned_match(self, match_uuid: str, user_id: int) -> Dict[str, Any]:
        match = self.store.find_match_by_uuid(match_uuid)
        if match is None or match["id_user_creator"] != user_id:
            raise TurnCycleError(TurnCycleError.MATCH_NOT_FOUND, "Match not found or not accessible")
        return match

    def _build_sequence(self, match_uuid, clock, status, active_id, rows, characters) -> TurnSequenceResult:
        by_id = {c["id"]: c for c in characters}
        entries = [
            TurnEntry(self._char_uuid(by_id, r["id_character_match"]), r["id_character_match"],
                      None, r["priority"], r["clock"], r["status"], r.get("pass_counter", 0),
                      r.get("timestamp_start"), r.get("timestamp_end"))
            for r in self._sorted(rows)
        ]
        active_uuid = self._char_uuid(by_id, active_id) if active_id is not None else None
        return TurnSequenceResult(match_uuid, clock, status, active_uuid, entries)

    @staticmethod
    def _sorted(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return sorted(rows, key=lambda r: r["priority"], reverse=True)

    @staticmethod
    def _highest_waiting(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        waiting = [r for r in sorted(rows, key=lambda r: r["priority"], reverse=True)
                   if r["status"] == tm.WAITING]
        return waiting[0] if waiting else None

    @staticmethod
    def _char_uuid(by_id: Dict[int, Dict[str, Any]], id_character: int) -> Optional[str]:
        c = by_id.get(id_character)
        return c["uuid"] if c else None
