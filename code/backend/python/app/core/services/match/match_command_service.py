"""Step 19 — single-player match creation service."""
import random
from datetime import datetime, timezone
import secrets
from typing import Any, Dict, List, Optional

from app.core.models.match import match_statuses
from app.core.models.match.match_models import (
    MatchCreateCommand,
    MatchCreationError,
    MatchSummary,
)
from app.core.ports.match.match_ports import (
    MatchCommandPort,
    MatchPersistencePort,
    StoryMatchReadPort,
    SystemModePort,
    TurnstileVerificationPort,
    UserAccessPort,
)
from app.core.ports.match import kpi_ports
from app.core.ports.match import log_writer_ports as lw
from app.core.services.match import trait_selection_validator


_BANNED_STATES = {3, 4}


class _PassthroughTurnstile(TurnstileVerificationPort):
    def verify(self, token, remote_ip) -> bool:
        return True


class MatchCommandService(MatchCommandPort):
    def __init__(
        self,
        story_read_port: StoryMatchReadPort,
        match_persistence_port: MatchPersistencePort,
        user_access_port: UserAccessPort,
        system_mode_port: SystemModePort,
        turnstile_port: Optional[TurnstileVerificationPort] = None,
        registry_service=None,
    ) -> None:
        self.story_read_port = story_read_port
        self.match_persistence_port = match_persistence_port
        self.user_access_port = user_access_port
        self.system_mode_port = system_mode_port
        self.turnstile_port = turnstile_port or _PassthroughTurnstile()
        self.registry_service = registry_service
        # Step 37 - set after construction; a story that ends fails whatever is still open.
        self.mission_service = None
        # v0.41.1 — MATCH_* lifecycle and ADMIN_* rows; None in the older tests.
        self.log_writer = None
        # v0.41.2 — MATCH_COMPLETED and the durations; None in the older tests.
        self.kpi = None

    def set_mission_service(self, mission_service) -> None:
        self.mission_service = mission_service

    def set_kpi(self, kpi) -> None:
        self.kpi = kpi

    def set_log_writer(self, log_writer) -> None:
        self.log_writer = log_writer

    def _log_match_row(self, uuid_match: str, message: Optional[str]) -> None:
        """v0.41.1 — one match-level row at the current clock; a rename alone writes nothing."""
        if self.log_writer is None or message is None:
            return
        match = self.match_persistence_port.find_match_by_uuid(uuid_match)
        if match is not None:
            self.log_writer.write(match["id"], None, None, match.get("current_clock") or 0, message)

    def create_match(self, command: MatchCreateCommand) -> MatchSummary:
        if (
            command is None
            or not command.user_uuid
            or not command.story_uuid
            or not command.difficulty_uuid
        ):
            raise MatchCreationError(
                MatchCreationError.INVALID_INPUT,
                "userUuid, storyUuid and difficultyUuid are required",
            )

        if not self.turnstile_port.verify(command.turnstile_token, command.remote_ip):
            raise MatchCreationError(
                MatchCreationError.TURNSTILE_VALIDATION_FAILED,
                "Turnstile verification failed",
            )

        if self.system_mode_port.is_maintenance():
            raise MatchCreationError(
                MatchCreationError.MAINTENANCE_MODE,
                "Server is under maintenance, no new match can be created",
            )

        user = self.user_access_port.find_by_uuid(command.user_uuid)
        if user is None:
            raise MatchCreationError(
                MatchCreationError.USER_NOT_FOUND, "User does not exist"
            )
        if user.get("state") in _BANNED_STATES:
            raise MatchCreationError(
                MatchCreationError.USER_BANNED,
                "User is not allowed to create matches",
            )

        story = self.story_read_port.find_story_by_uuid(command.story_uuid)
        if story is None:
            raise MatchCreationError(
                MatchCreationError.STORY_NOT_FOUND,
                f"Story not found: {command.story_uuid}",
            )

        difficulty = self.story_read_port.find_difficulty_by_uuid(
            story["id"], command.difficulty_uuid
        )
        if difficulty is None:
            raise MatchCreationError(
                MatchCreationError.DIFFICULTY_NOT_FOUND,
                f"Difficulty not found: {command.difficulty_uuid}",
            )

        self._validate_creator_trait_selection(story, difficulty, command)

        locations = self.story_read_port.find_locations_by_story_id(story["id"]) or []
        if not locations:
            raise MatchCreationError(
                MatchCreationError.STORY_HAS_NO_LOCATIONS,
                "Story has no locations defined",
            )
        keys = self.story_read_port.find_keys_by_story_id(story["id"]) or []

        # v0.32.1 — one active match per user and story. It runs last, after every
        # 404 and 400: a malformed request keeps reporting its own error whatever
        # the state is, and the state conflict is the only thing left to refuse.
        # Still before anything is written — a rejected creation persists nothing.
        if self.match_persistence_port.has_active_match_for_story(
            user["id"], story["id"], match_statuses.ACTIVE
        ):
            raise MatchCreationError(
                MatchCreationError.ACTIVE_MATCH_ALREADY_EXISTS,
                "An active match already exists for this user and story",
            )

        exp_cost = difficulty.get("exp_cost") if difficulty.get("exp_cost") is not None else 5

        saved = self.match_persistence_port.save_match({
            "id_story": story["id"],
            "id_difficulty": difficulty["id"],
            "id_user_creator": user["id"],
            "name": command.name,
            "status": "CREATED",
            "current_clock": 0,
            "exp_cost": exp_cost,
            "secure_location_param": 0,
            "counter_consecutive_pass": 0,
            "single_player": command.single_player if command.single_player is not None else 1,
            "character_template_uuid": command.character_template_uuid,
            "class_uuid": command.class_uuid,
            "trait_uuids": command.trait_uuids,
            # Step 27 — deterministic per-match RNG seed (explicit or random).
            "rng_seed": command.rng_seed if command.rng_seed is not None
            else secrets.randbits(63),
        })
        if self.log_writer is not None:
            self.log_writer.write(saved["id"], None, None, 0, lw.lifecycle(lw.LIFECYCLE_CREATED))

        location_rows: List[Dict[str, Any]] = []
        for loc in locations:
            location_rows.append({
                "id_match": saved["id"],
                "id_location": loc["id"],
                "flag_already_actived": 0,
                # Step 33 — the party starts IN the starting location, it never "enters"
                # it. Seeding it as already visited is what makes walking BACK there fire
                # id_event_not_first_time instead of announcing as a discovery the place
                # the story opened in. id_location_start is story-level, so this is
                # deterministic however many players join, in whatever order.
                "flag_visited": 1 if (story.get("id_location_start") is not None
                                      and loc["id"] == story["id_location_start"]) else 0,
                "clock_counter": loc.get("counter_time") or 0,
            })
        self.match_persistence_port.save_locations(location_rows)

        self.registry_service.seed(saved["id"], keys)

        return MatchSummary(
            uuid=saved["uuid"],
            story_uuid=story["uuid"],
            difficulty_uuid=difficulty["uuid"],
            name=saved.get("name"),
            status=saved["status"],
            current_clock=saved["current_clock"],
            exp_cost=saved["exp_cost"],
            user_creator_uuid=user["uuid"],
            ts_insert=saved["ts_insert"],
            single_player=saved.get("single_player"),
            character_template_uuid=saved.get("character_template_uuid"),
            class_uuid=saved.get("class_uuid"),
            trait_uuids=saved.get("trait_uuids") or [],
        )

    def _validate_creator_trait_selection(self, story, difficulty, command) -> None:
        """Step 23 — validates the creator loadout traits against the selected
        class and the difficulty cost budgets. The class is resolved leniently:
        an unknown class uuid is treated as "no class"."""
        clazz = None
        if command.class_uuid:
            clazz = self.story_read_port.find_class_by_uuid(story["id"], command.class_uuid)
        try:
            trait_selection_validator.resolve_and_validate(
                self.story_read_port, story["id"], clazz, difficulty, command.trait_uuids)
        except trait_selection_validator.TraitSelectionError as exc:
            raise MatchCreationError(exc.code, exc.message) from exc

    def update_match(self, uuid_match: str, status: Optional[str], name: Optional[str],
                     admin_action: Optional[str] = None) -> str:
        if status is not None and not match_statuses.is_valid(status):
            return "INVALID_STATUS"
        found = self.match_persistence_port.update_match_fields(uuid_match, status, name)
        if found:
            detail = (lw.admin(admin_action) if admin_action is not None
                      else lw.admin_status(status) if status is not None else None)
            self._log_match_row(uuid_match, detail)
        return "UPDATED" if found else "NOT_FOUND"

    def delete_match(self, uuid_match: str) -> str:
        match = self.match_persistence_port.find_match_by_uuid(uuid_match)
        if match is None:
            return "NOT_FOUND"
        # Only a stopped (terminal) match may be deleted.
        if not match_statuses.is_terminal(match.get("status")):
            return "NOT_STOPPED"
        self.match_persistence_port.delete_match_by_uuid(uuid_match)
        return "DELETED"

    def _record_completion(self, story_uuid, match) -> None:
        """v0.41.2 — MATCH_COMPLETED plus the durations, from the start stamp (else the creation)."""
        kpi = getattr(self, "kpi", None)
        if kpi is None:
            return
        kpi.record(story_uuid, kpi_ports.MATCH_COMPLETED, None, 1)
        duration_ms = millis_since(match.get("timestamp_start") or match.get("ts_insert"))
        if duration_ms is not None:
            kpi.record(story_uuid, kpi_ports.DURATION_MS, None, duration_ms)
        kpi.record(story_uuid, kpi_ports.DURATION_CLOCKS, None, int(match.get("current_clock") or 0))

    def end_match(self, uuid_match: str, uuid_event: str, user_uuid: str) -> str:
        if not uuid_match or not uuid_event or not user_uuid:
            return "NOT_FOUND"

        match = self.match_persistence_port.find_match_by_uuid(uuid_match)
        if match is None:
            return "NOT_FOUND"

        user = self.user_access_port.find_by_uuid(user_uuid)
        if user is None or user.get("id") != match.get("id_user_creator"):
            return "NOT_FOUND"

        story = self.story_read_port.find_story_by_id(match.get("id_story"))
        if story is None:
            return "NOT_ACCEPTABLE"
        end_event_id = story.get("id_event_end_game")
        if end_event_id is None:
            return "NOT_ACCEPTABLE"

        event = self.story_read_port.find_event_by_story_id_and_uuid(story["id"], uuid_event)
        if event is None or event.get("id") != end_event_id:
            return "NOT_ACCEPTABLE"

        already_over = match_statuses.is_terminal(match.get("status"))
        self.match_persistence_port.update_match_fields(uuid_match, match_statuses.ENDED, None)
        if not already_over:
            self._record_completion(story.get("uuid"), match)
        # Step 37 — a mission that opened and never closed has now failed; one never reached
        # is simply ignored, as it was never the player's business.
        if getattr(self, "mission_service", None) is not None:
            self.mission_service.on_story_end(match["id"])
        self._log_match_row(uuid_match, lw.lifecycle(lw.LIFECYCLE_ENDED))
        return "COMPLETED"


def millis_since(iso_instant) -> Optional[int]:
    """v0.41.2 — milliseconds from an ISO instant to now (never negative); None when unreadable."""
    if not iso_instant or not str(iso_instant).strip():
        return None
    try:
        start = datetime.fromisoformat(str(iso_instant).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - start).total_seconds() * 1000))
