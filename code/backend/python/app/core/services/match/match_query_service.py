"""Step 19 — match read-side service."""
from typing import List, Optional

from app.core.models.match.match_models import (
    EventInfo,
    LocationInfo,
    LocationNeighborInfo,
    MatchDetail,
    MatchLocationState,
    MatchRegistryEntry,
    MatchSummary,
)
from app.core.ports.match.match_ports import (
    CharacterReadPort,
    MatchPersistencePort,
    MatchQueryPort,
    StoryMatchReadPort,
    UserAccessPort,
)
from app.core.services.match.character_query_service import build_character_infos


class MatchQueryService(MatchQueryPort):
    def __init__(
        self,
        match_persistence_port: MatchPersistencePort,
        story_read_port: StoryMatchReadPort,
        user_access_port: UserAccessPort,
        character_read_port: Optional[CharacterReadPort] = None,
    ) -> None:
        self.match_persistence_port = match_persistence_port
        self.story_read_port = story_read_port
        self.user_access_port = user_access_port
        # Step 21 — optional; when set, _build_detail populates the players list.
        self.character_read_port = character_read_port

    def list_user_matches(self, user_uuid: str) -> List[MatchSummary]:
        if not user_uuid:
            return []
        user = self.user_access_port.find_by_uuid(user_uuid)
        if user is None:
            return []
        rows = self.match_persistence_port.find_matches_by_user_id(user["id"])
        return [self._summary_with_story(r, user["uuid"]) for r in rows]

    def list_all_matches(self) -> List[MatchSummary]:
        rows = self.match_persistence_port.find_all_matches()
        return [self._summary_with_story(r, None) for r in rows]

    def _summary_with_story(self, row, user_uuid) -> MatchSummary:
        # Resolve the match's story so the list summary carries storyUuid/difficultyUuid,
        # consistent with GET /match/{uuid}/info (which used to be the only place that did).
        story = (
            self.story_read_port.find_story_by_id(row["id_story"])
            if row.get("id_story") is not None
            else None
        )
        difficulty = (
            self.story_read_port.find_difficulty_by_id(row["id_story"], row.get("id_difficulty"))
            if story is not None and row.get("id_difficulty") is not None
            else None
        )
        return self._to_summary(
            row,
            user_uuid,
            story["uuid"] if story else None,
            difficulty["uuid"] if difficulty else None,
        )

    def get_match_info(self, match_uuid: str, user_uuid: str) -> Optional[MatchDetail]:
        if not match_uuid or not user_uuid:
            return None
        user = self.user_access_port.find_by_uuid(user_uuid)
        if user is None:
            return None
        match = self.match_persistence_port.find_match_by_uuid(match_uuid)
        if match is None or match.get("id_user_creator") != user["id"]:
            return None
        return self._build_detail(match, user["uuid"])

    def get_match_info_for_admin(self, match_uuid: str) -> Optional[MatchDetail]:
        if not match_uuid:
            return None
        match = self.match_persistence_port.find_match_by_uuid(match_uuid)
        if match is None:
            return None
        # Admin view — no ownership check. user_creator_uuid is left None,
        # consistent with the admin list (list_all_matches).
        return self._build_detail(match, None)

    def _build_detail(self, match, user_creator_uuid) -> MatchDetail:
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

        summary = self._to_summary(
            match,
            user_creator_uuid,
            story["uuid"] if story else None,
            difficulty["uuid"] if difficulty else None,
        )

        # Step 21 — populate the players/characters of the match (empty when no
        # character read port is wired).
        players = []
        if self.character_read_port is not None:
            requester_id = match.get("id_user_creator") if user_creator_uuid else None
            players = build_character_infos(
                self.character_read_port.find_characters_by_match_id(match["id"]),
                match, self.story_read_port, self.character_read_port,
                user_creator_uuid, requester_id,
            )

        # Locations currently occupied by one or more players (insertion-ordered).
        active_loc_ids = []
        for p in players:
            if p.id_location is not None and p.id_location not in active_loc_ids:
                active_loc_ids.append(p.id_location)

        # Current location now reflects where the player actually is; fall back to
        # the story start location when no player/idLocation is available.
        current_loc_id = active_loc_ids[0] if active_loc_ids else (
            story.get("id_location_start") if story else None
        )
        current_loc = loc_by_id.get(current_loc_id) if current_loc_id else None

        story_id = story.get("id") if story else None
        end_event_id = story.get("id_event_end_game") if story else None
        locations_active = self._build_locations_active(
            story_id, end_event_id, active_loc_ids, loc_by_id
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
            players=players,
            locations_active=locations_active,
        )

    def _build_locations_active(self, story_id, end_event_id, active_loc_ids, loc_by_id) -> List[LocationInfo]:
        """Build the enriched ``locations_active`` list: each player-occupied
        location with its card, the neighbor links touching it (both directions)
        and the events specific to it — each with a resolved card."""
        result: List[LocationInfo] = []
        if not story_id or not active_loc_ids:
            return result

        neighbors = self.story_read_port.find_location_neighbors_by_story_id(story_id)
        events = self.story_read_port.find_events_by_story_id(story_id)

        for loc_id in active_loc_ids:
            loc = loc_by_id.get(loc_id)
            if loc is None:
                continue

            neighbor_infos: List[LocationNeighborInfo] = []
            for n in neighbors:
                other_id = self._neighbor_other_endpoint(n, loc_id)
                if other_id is None:
                    continue
                other = loc_by_id.get(other_id)
                neighbor_card_id = n.get("id_card")
                if neighbor_card_id is None and other is not None:
                    neighbor_card_id = other.get("id_card")
                neighbor_infos.append(LocationNeighborInfo(
                    id_location=other_id,
                    uuid=other["uuid"] if other else None,
                    direction=n.get("direction"),
                    flag_back=n.get("flag_back"),
                    energy_cost=n.get("energy_cost"),
                    card=self._resolve_card(story_id, neighbor_card_id),
                ))

            event_infos: List[EventInfo] = []
            for e in events:
                if e.get("id_location") == loc_id:
                    event_infos.append(EventInfo(
                        uuid=e.get("uuid"),
                        type=e.get("type"),
                        end_game=(end_event_id is not None and e.get("id") == end_event_id),
                        card=self._resolve_card(story_id, e.get("id_card")),
                    ))

            result.append(LocationInfo(
                id_location=loc_id,
                uuid=loc.get("uuid"),
                card=self._resolve_card(story_id, loc.get("id_card")),
                neighbors=neighbor_infos,
                events=event_infos,
            ))
        return result

    @staticmethod
    def _neighbor_other_endpoint(neighbor, loc_id):
        """Return the endpoint of a neighbor link that is NOT ``loc_id``, or None
        when the link does not touch ``loc_id``."""
        frm = neighbor.get("id_location_from")
        to = neighbor.get("id_location_to")
        if frm == loc_id:
            return to
        if to == loc_id:
            return frm
        return None

    def _resolve_card(self, story_id, id_card, lang="en"):
        """Resolve an ``id_card`` reference to a camelCase card dict mirroring
        CardInfoResponse, or None. Card text falls back to English."""
        if id_card is None:
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
            single_player=row.get("single_player"),
            character_template_uuid=row.get("character_template_uuid"),
            class_uuid=row.get("class_uuid"),
            trait_uuids=row.get("trait_uuids") or [],
        )
