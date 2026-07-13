"""Step 19 — match read-side service."""
import base64
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from app.core.services.match import event_availability
from app.core.models.match.match_models import (
    EventInfo,
    LocationInfo,
    LocationNeighborInfo,
    MatchDetail,
    MatchListFilter,
    MatchLocationState,
    MatchRegistryEntry,
    MatchSummary,
    MatchSummaryPage,
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
        movement_store=None,
        event_store=None,
    ) -> None:
        self.match_persistence_port = match_persistence_port
        self.story_read_port = story_read_port
        self.user_access_port = user_access_port
        # Step 21 — optional; when set, _build_detail populates the players list.
        self.character_read_port = character_read_port
        # v0.28.6 — optional movement store (has find_visited_location_ids); used
        # to hide a neighbor's location-card fallback for never-visited
        # destinations (fog of war). When None, no gating is applied.
        self.movement_store = movement_store
        # Step 29 — loads the check context once per request so every event of
        # locations_active can report its `available` flag (and, when blocked, the reason).
        # None (legacy wiring) makes every event report unavailable rather than pretend to work.
        self.event_store = event_store

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

    def list_matches_page(self, filter: MatchListFilter) -> MatchSummaryPage:
        # v0.28.1 — paginated, filterable admin list. Resolve creator/story uuids
        # to ids first; an unknown uuid yields an empty page rather than silently
        # dropping the filter (which would leak unrelated matches).
        f = filter or MatchListFilter()
        limit = _clamp_limit(f.limit)

        id_user = None
        if f.user_uuid and f.user_uuid.strip():
            user = self.user_access_port.find_by_uuid(f.user_uuid)
            if user is None:
                return MatchSummaryPage(items=[], next_cursor=None, limit=limit)
            id_user = user["id"]

        id_story = None
        if f.story_uuid and f.story_uuid.strip():
            story = self.story_read_port.find_story_by_uuid(f.story_uuid)
            if story is None:
                return MatchSummaryPage(items=[], next_cursor=None, limit=limit)
            id_story = story["id"]

        ts_from = _since_days_to_ts(f.since_days)
        status = f.status if (f.status and f.status.strip()) else None
        ts_cursor, id_cursor = _decode_cursor(f.cursor)

        # Over-fetch one row to learn whether a further page exists.
        rows = self.match_persistence_port.find_matches_page(
            status, id_user, id_story, ts_from, ts_cursor, id_cursor, limit + 1
        )
        has_more = len(rows) > limit
        page_rows = rows[:limit] if has_more else rows
        items = [self._summary_with_story(r, None) for r in page_rows]
        next_cursor = None
        if has_more and page_rows:
            last = page_rows[-1]
            next_cursor = _encode_cursor(last.get("ts_insert"), last.get("id"))
        return MatchSummaryPage(items=items, next_cursor=next_cursor, limit=limit)

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

    def get_match_info(self, match_uuid: str, user_uuid: str, lang: str = "en") -> Optional[MatchDetail]:
        if not match_uuid or not user_uuid:
            return None
        user = self.user_access_port.find_by_uuid(user_uuid)
        if user is None:
            return None
        match = self.match_persistence_port.find_match_by_uuid(match_uuid)
        if match is None or match.get("id_user_creator") != user["id"]:
            return None
        return self._build_detail(match, user["uuid"], lang if lang and lang.strip() else "en",
                                  all_locations=False)

    def get_match_info_for_admin(self, match_uuid: str) -> Optional[MatchDetail]:
        if not match_uuid:
            return None
        match = self.match_persistence_port.find_match_by_uuid(match_uuid)
        if match is None:
            return None
        # Admin view — no ownership check. user_creator_uuid is left None,
        # consistent with the admin list (list_all_matches). The admin also keeps
        # EVERY location (no visited filter) so the console can render the full
        # gaming_state_locations table; the fog-of-war gating on the neighbor
        # cards stays identical to the player view.
        return self._build_detail(match, None, "en", all_locations=True)

    def _build_detail(self, match, user_creator_uuid, lang: str = "en",
                      all_locations: bool = False) -> MatchDetail:
        """Build the full MatchDetail.

        ``all_locations`` keeps EVERY story location in ``locations`` instead of
        only the visited ones. Set by the admin endpoint, which needs the full
        runtime table."""
        story = self.story_read_port.find_story_by_id(match["id_story"])
        difficulty = self.story_read_port.find_difficulty_by_id(
            match["id_story"], match["id_difficulty"]
        ) if story else None
        locations = self.story_read_port.find_locations_by_story_id(match["id_story"]) if story else []
        loc_by_id = {l["id"]: l for l in locations}

        # v0.28.6 — visited set (character positions ∪ movement log), the same set
        # GET /locations returns. It gates the neighbor location cards below and,
        # on the player endpoint, filters the locations list itself. None → no gating.
        visited_loc_ids = (
            set(self.movement_store.find_visited_location_ids(match["id"]))
            if self.movement_store is not None else None
        )

        state_rows = self.match_persistence_port.find_locations_by_match_id(match["id"])
        location_states = [
            MatchLocationState(
                id_location=r["id_location"],
                uuid=r["uuid"],
                flag_already_actived=r["flag_already_actived"],
                clock_counter=r["clock_counter"],
            )
            for r in state_rows
            if all_locations or visited_loc_ids is None
            or r["id_location"] in visited_loc_ids
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
        # Step 29 — ONE context for every event of the payload: the checker is a pure
        # function over it, so fifty events cost exactly what one costs.
        check_ctx = self._load_check_context(match)
        locations_active = self._build_locations_active(
            story_id, end_event_id, active_loc_ids, loc_by_id, lang, visited_loc_ids, check_ctx
        )

        return MatchDetail(
            match=summary,
            current_location_id=current_loc_id,
            current_location_uuid=current_loc["uuid"] if current_loc else None,
            locations=location_states,
            registry=registry,
            events=[],
            choices=[],
            players=players,
            locations_active=locations_active,
        )

    def _load_check_context(self, match):
        """The check context of the match's reference character — in single-player the only
        one, and the creator's. Loaded once per request; None when no event store is wired.

        The admin view uses the same reference character, so the console sees exactly the
        flags the player would. Per-character availability arrives with multiplayer.
        """
        if self.event_store is None or self.character_read_port is None:
            return None
        ref_id = None
        for c in self.character_read_port.find_characters_by_match_id(match["id"]) or []:
            if c.get("id_user") == match.get("id_user_creator"):
                ref_id = c.get("id")
                break
        return self.event_store.load_check_context(match["id"], ref_id)

    def _build_locations_active(self, story_id, end_event_id, active_loc_ids, loc_by_id, lang: str = "en", visited_loc_ids=None, check_ctx=None) -> List[LocationInfo]:
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
                # One-way link (flag_back=NO): hide it when standing on the
                # destination (id_location_to), since you cannot go back.
                if not self._neighbor_traversable_from(n, loc_id):
                    continue
                other = loc_by_id.get(other_id)
                # v0.28.6 fog of war — keep the authored LINK card, but only fall
                # back to the destination LOCATION's card when it has been visited
                # (or when gating is unavailable).
                other_visited = visited_loc_ids is None or other_id in visited_loc_ids
                neighbor_card_id = n.get("id_card")
                if neighbor_card_id is None and other is not None and other_visited:
                    neighbor_card_id = other.get("id_card")
                # Optional "return" card: falls back to the forward card (id_card)
                # when the link defines no id_card_back.
                neighbor_card_back_id = n.get("id_card_back")
                if neighbor_card_back_id is None:
                    neighbor_card_back_id = neighbor_card_id
                from_id = n.get("id_location_from")
                to_id = n.get("id_location_to")
                neighbor_infos.append(LocationNeighborInfo(
                    id_location=other_id,
                    uuid=other["uuid"] if other else None,
                    direction=n.get("direction"),
                    flag_back=n.get("flag_back"),
                    energy_cost=n.get("energy_cost"),
                    card=self._resolve_card(story_id, neighbor_card_id, lang),
                    secure_param=other.get("secure_param") if other else None,
                    id_location_from=from_id,
                    id_location_to=to_id,
                    card_back=self._resolve_card(story_id, neighbor_card_back_id, lang),
                    card_location_from=self._resolve_location_card(
                        story_id, from_id, loc_by_id, lang, visited_loc_ids),
                    card_location_to=self._resolve_location_card(
                        story_id, to_id, loc_by_id, lang, visited_loc_ids),
                ))

            event_infos: List[EventInfo] = []
            for e in events:
                if e.get("id_specific_location") == loc_id:
                    # Step 29 — no port call in this loop: the context was loaded once.
                    verdict = event_availability.check(e, check_ctx)
                    event_infos.append(EventInfo(
                        uuid=e.get("uuid"),
                        type=e.get("type"),
                        end_game=(end_event_id is not None and e.get("id") == end_event_id),
                        card=self._resolve_card(story_id, e.get("id_card"), lang),
                        available=verdict.available,
                        reason=verdict.reason,
                    ))

            result.append(LocationInfo(
                id_location=loc_id,
                uuid=loc.get("uuid"),
                id_card=loc.get("id_card"),
                card=self._resolve_card(story_id, loc.get("id_card"), lang),
                neighbors=neighbor_infos,
                events=event_infos,
                secure_param=loc.get("secure_param"),
            ))
        return result

    @staticmethod
    def _neighbor_traversable_from(neighbor, loc_id):
        """Whether the link can be traversed from ``loc_id``. Forward
        (loc_id == id_location_from) is always allowed; backward (loc_id ==
        id_location_to) only when ``flag_back == 1`` (a two-way link)."""
        if neighbor.get("id_location_from") == loc_id:
            return True
        return neighbor.get("id_location_to") == loc_id and (neighbor.get("flag_back") or 0) == 1

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

    def _resolve_location_card(self, story_id, loc_id, loc_by_id, lang, visited_loc_ids):
        """Resolve the card of the LOCATION sitting at one endpoint of a neighbor
        link, gated on that location's own fog-of-war flag: None until it has been
        visited. A None ``visited_loc_ids`` disables the gating."""
        if loc_id is None or (visited_loc_ids is not None and loc_id not in visited_loc_ids):
            return None
        loc = loc_by_id.get(loc_id)
        return self._resolve_card(story_id, loc.get("id_card"), lang) if loc else None

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


# ── v0.28.1 admin-list pagination helpers ────────────────────────────────────

DEFAULT_PAGE_LIMIT = 50
MAX_PAGE_LIMIT = 200


def _clamp_limit(requested) -> int:
    """Clamp the requested page size to [1, MAX_PAGE_LIMIT]; default when unset."""
    if requested is None:
        return DEFAULT_PAGE_LIMIT
    try:
        value = int(requested)
    except (TypeError, ValueError):
        return DEFAULT_PAGE_LIMIT
    return max(1, min(value, MAX_PAGE_LIMIT))


def _since_days_to_ts(since_days) -> Optional[str]:
    """sinceDays → ISO-8601 lower bound on ts_insert; None when unset/≤0."""
    if since_days is None:
        return None
    try:
        days = int(since_days)
    except (TypeError, ValueError):
        return None
    if days <= 0:
        return None
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _encode_cursor(ts_insert: Optional[str], row_id: Optional[int]) -> Optional[str]:
    """Encode the keyset position (ts_insert|id) as an opaque base64 token."""
    if ts_insert is None or row_id is None:
        return None
    raw = f"{ts_insert}|{row_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def _decode_cursor(cursor: Optional[str]):
    """Decode an opaque cursor into (ts_cursor, id_cursor).

    Returns ``(None, None)`` for a missing or malformed token, so the query
    simply starts from the first page instead of failing."""
    if not cursor:
        return None, None
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
    except (ValueError, TypeError):
        return None, None
    sep = raw.rfind("|")
    if sep <= 0 or sep == len(raw) - 1:
        return None, None
    try:
        id_cursor = int(raw[sep + 1:])
    except ValueError:
        return None, None
    return raw[:sep], id_cursor
