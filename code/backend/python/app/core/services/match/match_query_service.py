"""Step 19 — match read-side service."""
from typing import List, Optional

from app.core.models.match.match_models import (
    MatchDetail,
    MatchLocationState,
    MatchRegistryEntry,
    MatchSummary,
)
from app.core.ports.match.match_ports import (
    MatchPersistencePort,
    MatchQueryPort,
    StoryMatchReadPort,
    UserAccessPort,
)


class MatchQueryService(MatchQueryPort):
    def __init__(
        self,
        match_persistence_port: MatchPersistencePort,
        story_read_port: StoryMatchReadPort,
        user_access_port: UserAccessPort,
    ) -> None:
        self.match_persistence_port = match_persistence_port
        self.story_read_port = story_read_port
        self.user_access_port = user_access_port

    def list_user_matches(self, user_uuid: str) -> List[MatchSummary]:
        if not user_uuid:
            return []
        user = self.user_access_port.find_by_uuid(user_uuid)
        if user is None:
            return []
        rows = self.match_persistence_port.find_matches_by_user_id(user["id"])
        return [self._to_summary(r, user["uuid"], None, None) for r in rows]

    def get_match_info(self, match_uuid: str, user_uuid: str) -> Optional[MatchDetail]:
        if not match_uuid or not user_uuid:
            return None
        user = self.user_access_port.find_by_uuid(user_uuid)
        if user is None:
            return None
        match = self.match_persistence_port.find_match_by_uuid(match_uuid)
        if match is None or match.get("id_user_creator") != user["id"]:
            return None

        story = self.story_read_port.find_story_by_id(match["id_story"])
        difficulty = self.story_read_port.find_difficulty_by_id(
            match["id_story"], match["id_difficulty"]
        ) if story else None
        locations = self.story_read_port.find_locations_by_story_id(match["id_story"]) if story else []
        loc_by_id = {l["id"]: l for l in locations}

        state_rows = self.match_persistence_port.find_locations_by_match_id(match["id"])
        location_states = [
            MatchLocationState(
                id_location=r["id_location"],
                uuid=r["uuid"],
                flag_already_actived=r["flag_already_actived"],
                clock_counter=r["clock_counter"],
                name=f"location-{r['id_location']}" if r["id_location"] in loc_by_id else None,
            )
            for r in state_rows
        ]

        registry_rows = self.match_persistence_port.find_registry_by_match_id(match["id"])
        registry = [
            MatchRegistryEntry(
                uuid=r["uuid"],
                key=r["key"],
                string_value=r.get("string_value"),
                int_value=r.get("int_value"),
            )
            for r in registry_rows
        ]

        current_loc_id = story.get("id_location_start") if story else None
        current_loc = loc_by_id.get(current_loc_id) if current_loc_id else None

        summary = self._to_summary(
            match,
            user["uuid"],
            story["uuid"] if story else None,
            difficulty["uuid"] if difficulty else None,
        )

        return MatchDetail(
            match=summary,
            current_location_id=current_loc_id,
            current_location_uuid=current_loc["uuid"] if current_loc else None,
            current_location_name=f"location-{current_loc['id']}" if current_loc else None,
            locations=location_states,
            registry=registry,
            events=[],
            choices=[],
        )

    @staticmethod
    def _to_summary(row, user_uuid, story_uuid, difficulty_uuid):
        return MatchSummary(
            uuid=row["uuid"],
            story_uuid=story_uuid,
            difficulty_uuid=difficulty_uuid,
            name=row.get("name"),
            status=row["status"],
            current_clock=row["current_clock"],
            exp_cost=row["exp_cost"],
            user_creator_uuid=user_uuid,
            ts_insert=row["ts_insert"],
        )
