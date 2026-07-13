"""Step 19 — match ports definitions."""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.models.match.match_models import (
    CharacterInstanceInfo,
    JoinMatchCommand,
    MatchCreateCommand,
    MatchDetail,
    MatchListFilter,
    MatchSummary,
    MatchSummaryPage,
)


class MatchCommandPort(ABC):
    @abstractmethod
    def create_match(self, command: MatchCreateCommand) -> MatchSummary:
        """Persist a new match for the given user. Raises
        :class:`MatchCreationError` for validation failures."""

    @abstractmethod
    def update_match(self, uuid_match: str, status: Optional[str], name: Optional[str]) -> str:
        """Update a match's status and/or name (admin operation).

        Returns one of ``'UPDATED'``, ``'NOT_FOUND'`` or ``'INVALID_STATUS'``."""

    @abstractmethod
    def delete_match(self, uuid_match: str) -> str:
        """Delete a match together with its runtime state (admin operation).
        Only matches in a terminal status (ENDED / GAMEOVER) may be deleted.

        Returns one of ``'DELETED'``, ``'NOT_FOUND'`` or ``'NOT_STOPPED'``."""

    @abstractmethod
    def end_match(self, uuid_match: str, uuid_event: str, user_uuid: str) -> str:
        """Step 20.1 — completes a match (status → ENDED) when ``uuid_event`` is
        the story's ``idEventEndGame``. Caller must be the match owner.

        Returns one of:
          - ``'COMPLETED'``  — match status set to ENDED;
          - ``'NOT_ACCEPTABLE'`` — event is not the configured end-game event;
          - ``'NOT_FOUND'`` — unknown match or caller is not the owner."""


class MatchQueryPort(ABC):
    @abstractmethod
    def list_user_matches(self, user_uuid: str) -> List[MatchSummary]:
        ...

    @abstractmethod
    def list_all_matches(self) -> List[MatchSummary]:
        """Return every match in the platform, newest first (admin view)."""

    @abstractmethod
    def list_matches_page(self, filter: MatchListFilter) -> MatchSummaryPage:
        """v0.28.1 — return one keyset page of the admin match list, applying the
        optional filters (status / creator / story / sinceDays) and resuming from
        ``filter.cursor``. Backs GET /api/admin/matches."""

    @abstractmethod
    def get_match_info(self, match_uuid: str, user_uuid: str, lang: str = "en") -> Optional[MatchDetail]:
        ...

    @abstractmethod
    def get_match_info_for_admin(self, match_uuid: str) -> Optional[MatchDetail]:
        """Return the full match detail for the admin view — without the
        per-user ownership check. Returns None only when the match is unknown."""
        ...


class MatchPersistencePort(ABC):
    @abstractmethod
    def save_match(self, match: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a row into ``gaming_match`` and return the saved fields
        including the generated id, uuid and timestamps."""

    @abstractmethod
    def find_match_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_matches_by_user_id(self, user_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_all_matches(self) -> List[Dict[str, Any]]:
        """Return every ``gaming_match`` row, newest first."""

    @abstractmethod
    def find_matches_page(self, status: Optional[str], id_user: Optional[int],
                          id_story: Optional[int], ts_from: Optional[str],
                          ts_cursor: Optional[str], id_cursor: Optional[int],
                          limit: int) -> List[Dict[str, Any]]:
        """v0.28.1 — keyset page of matches (newest first) matching the resolved
        filters. Any ``None`` filter is ignored. ``ts_from`` is an ISO lower bound;
        ``ts_cursor``/``id_cursor`` carry the keyset position. Returns at most
        ``limit`` rows."""

    @abstractmethod
    def save_locations(self, rows: List[Dict[str, Any]]) -> None:
        ...

    @abstractmethod
    def save_registry(self, rows: List[Dict[str, Any]]) -> None:
        ...

    @abstractmethod
    def find_locations_by_match_id(self, match_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_registry_by_match_id(self, match_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def delete_matches_by_name_like(self, name_like_pattern: str) -> int:
        """Delete all matches whose name matches the given SQL LIKE pattern,
        together with their derived runtime state (locations and registry
        rows). Used by the dev-only test-data cleanup. Returns the number of
        matches removed."""
        ...

    @abstractmethod
    def update_match_fields(self, uuid: str, status: Optional[str], name: Optional[str]) -> bool:
        """Update the status and/or name of a single match. A ``None`` field is
        left unchanged. Returns ``False`` when no match has the given uuid."""
        ...

    @abstractmethod
    def delete_match_by_uuid(self, uuid: str) -> bool:
        """Delete a single match by uuid together with its derived runtime
        state. Returns ``False`` when no match has the given uuid."""
        ...


class StoryMatchReadPort(ABC):
    """Read-side helper used by the match domain to inspect story tables."""

    @abstractmethod
    def find_story_by_uuid(self, story_uuid: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_story_by_id(self, story_id: int) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_difficulty_by_uuid(self, story_id: int, difficulty_uuid: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_difficulty_by_id(self, story_id: int, difficulty_id: int) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_locations_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_keys_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_event_by_story_id_and_uuid(self, story_id: int, uuid_event: str) -> Optional[Dict[str, Any]]:
        """Step 20.1 — return ``{"id": int, "uuid": str}`` for the event with
        the given uuid in the given story, or ``None`` when no such event exists."""
        ...

    @abstractmethod
    def find_location_neighbors_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        """Step 27.x — all neighbor links of a story
        ({id_location_from, id_location_to, direction, energy_cost, id_card})."""
        ...

    @abstractmethod
    def find_events_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        """Step 27.x — all events of a story
        ({id, uuid, type, id_location, id_card})."""
        ...

    @abstractmethod
    def find_card_by_story_id_and_card_id(self, story_id: int, card_id: int) -> Optional[Dict[str, Any]]:
        """Step 27.x — the card row referenced by an ``id_card`` integer, or
        None when missing."""
        ...

    @abstractmethod
    def find_text_by_story_id_text_and_lang(
        self, story_id: int, id_text: int, lang: str
    ) -> Optional[Dict[str, Any]]:
        """Step 27.x — a single text row by story, id_text and language
        ({short_text, long_text}), or None."""
        ...

    # === Step 21 — character template / class / trait lookups ===

    @abstractmethod
    def find_character_template_by_uuid(self, story_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        """Return a template dict (id_tipo, uuid, *_max, *_start, id_class_permitted,
        id_class_prohibited) or None."""
        ...

    @abstractmethod
    def find_character_templates_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        """Return all character templates of a story (used to map id_tipo -> uuid)."""
        ...

    @abstractmethod
    def find_class_by_uuid(self, story_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        """Return a class dict (id, uuid, *_base, weight_max) or None."""
        ...

    @abstractmethod
    def find_trait_by_uuid(self, story_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        """Return a trait dict (id, uuid, life/energy/sad/dexterity/intelligence/constitution) or None."""
        ...

    @abstractmethod
    def find_traits_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        """Return all traits of a story (used to map trait id -> uuid)."""
        ...

    @abstractmethod
    def find_class_bonuses_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        """Return all class-bonus rows of a story ({id_class, statistic, value})."""
        ...

    @abstractmethod
    def find_items_by_story_id(self, story_id: int) -> List[Dict[str, Any]]:
        """Step 27 — return all items of a story ({id, uuid, weight}); used to
        resolve a character's inventory items and carried weight."""
        ...


class CharacterCommandPort(ABC):
    @abstractmethod
    def join(self, command: JoinMatchCommand) -> CharacterInstanceInfo:
        """Step 21 — instantiate the caller's character in the match. Raises
        :class:`CharacterJoinError` for validation failures."""

    @abstractmethod
    def change_statistics(self, match_uuid: str, player_uuid: str,
                          dex: Optional[int], intel: Optional[int], con: Optional[int],
                          energy: Optional[int], life: Optional[int], sad: Optional[int],
                          coin: Optional[int], food: Optional[int],
                          magic: Optional[int]) -> str:
        """Admin — override current statistics of a character instance.
        Pass None to skip a field. For energy/life/sad the value is capped at max.

        Returns one of ``'UPDATED'``, ``'MATCH_NOT_FOUND'``, ``'PLAYER_NOT_FOUND'``."""


class CharacterQueryPort(ABC):
    @abstractmethod
    def list_players(self, match_uuid: str, user_uuid: str) -> Optional[List[CharacterInstanceInfo]]:
        """Return the characters of a match, or None when the match is missing
        or the user has no access."""

    @abstractmethod
    def get_character(self, match_uuid: str, character_uuid: str, user_uuid: str) -> Optional[CharacterInstanceInfo]:
        """Return a single character detail, or None when missing/not accessible."""


class CharacterPersistencePort(ABC):
    @abstractmethod
    def save_character(self, row: Dict[str, Any]) -> Dict[str, Any]:
        ...

    @abstractmethod
    def save_backpack(self, row: Dict[str, Any]) -> None:
        ...

    @abstractmethod
    def save_traits(self, rows: List[Dict[str, Any]]) -> None:
        ...

    @abstractmethod
    def find_character_by_match_and_user(self, match_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def count_characters_by_match_id(self, match_id: int) -> int:
        ...

    @abstractmethod
    def update_character_stats(self, match_id: int, character_id: int,
                               dex: Optional[int], intel: Optional[int], con: Optional[int],
                               energy: Optional[int], life: Optional[int],
                               sad: Optional[int]) -> None:
        """Admin: persist updated base stats on the character instance. None = skip."""

    @abstractmethod
    def update_backpack_stats(self, match_id: int, character_id: int,
                              food: Optional[int], magic: Optional[int],
                              coin: Optional[int]) -> None:
        """Admin: persist updated backpack resources. None = skip."""


class CharacterReadPort(ABC):
    @abstractmethod
    def find_characters_by_match_id(self, match_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_character_by_match_and_uuid(self, match_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_backpack(self, match_id: int, character_id: int) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_traits(self, match_id: int, character_id: int) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def find_inventory(self, match_id: int, character_id: int) -> List[Dict[str, Any]]:
        """Step 27 — the items a character carries inside a match
        ({uuid, id_item, amount, state})."""
        ...


class UserAccessPort(ABC):
    @abstractmethod
    def find_by_uuid(self, user_uuid: str) -> Optional[Dict[str, Any]]:
        """Return the minimum subset of the user row required by the match
        domain (id, uuid, username, role, state) or None when the user is
        unknown."""


class SystemModePort(ABC):
    @abstractmethod
    def is_maintenance(self) -> bool:
        ...


class TurnstileVerificationPort(ABC):
    @abstractmethod
    def verify(self, token: Optional[str], remote_ip: Optional[str]) -> bool:
        """Return True when the Turnstile token is valid or validation is disabled."""
