"""Step 19 — single-player match creation service."""
from typing import Any, Dict, List

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
    UserAccessPort,
)


_BANNED_STATES = {3, 4}


class MatchCommandService(MatchCommandPort):
    def __init__(
        self,
        story_read_port: StoryMatchReadPort,
        match_persistence_port: MatchPersistencePort,
        user_access_port: UserAccessPort,
        system_mode_port: SystemModePort,
    ) -> None:
        self.story_read_port = story_read_port
        self.match_persistence_port = match_persistence_port
        self.user_access_port = user_access_port
        self.system_mode_port = system_mode_port

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

        locations = self.story_read_port.find_locations_by_story_id(story["id"]) or []
        if not locations:
            raise MatchCreationError(
                MatchCreationError.STORY_HAS_NO_LOCATIONS,
                "Story has no locations defined",
            )
        keys = self.story_read_port.find_keys_by_story_id(story["id"]) or []

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
        })

        location_rows: List[Dict[str, Any]] = []
        for loc in locations:
            location_rows.append({
                "id_match": saved["id"],
                "id_location": loc["id"],
                "flag_already_actived": 0,
                "clock_counter": loc.get("counter_start") or loc.get("counter_time") or 0,
            })
        self.match_persistence_port.save_locations(location_rows)

        registry_rows: List[Dict[str, Any]] = []
        next_id = 1
        for k in keys:
            row = {
                "id": next_id,
                "id_match": saved["id"],
                "key": k.get("key_name") or k.get("name") or "",
                "string_value": None,
                "int_value": None,
            }
            self._apply_default(row, k.get("key_value") or k.get("value"))
            registry_rows.append(row)
            next_id += 1
        self.match_persistence_port.save_registry(registry_rows)

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

    @staticmethod
    def _apply_default(row: Dict[str, Any], raw_value):
        if raw_value is None:
            return
        if not isinstance(raw_value, str):
            try:
                row["int_value"] = int(raw_value)
            except (TypeError, ValueError):
                row["string_value"] = str(raw_value)
            return
        trimmed = raw_value.strip()
        if trimmed == "":
            row["string_value"] = ""
            return
        try:
            row["int_value"] = int(trimmed)
        except ValueError:
            row["string_value"] = trimmed
