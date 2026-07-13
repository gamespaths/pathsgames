"""Step 28.7 — match logs service (Python backend).

Returns a consolidated timeline of all logged events for a match:
WEATHER, MOVEMENT, SLEEP, CLOCK_ADVANCE, RECOVERY. Sorted by timestamp ascending.

v0.28.7 — the timeline is cursor-paginated (opaque base64 offset token, same envelope
convention as the paginated admin match list) and the entries on the returned page are
enriched: WEATHER carries the weather's card, MOVEMENT carries the destination
location's card, and every character-scoped entry names the character that acted.
"""
import base64
from dataclasses import asdict
from typing import Any, Dict, List, Optional

from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    LogClockHistoryEntity,
    LogEventsEntity,
    LogMovementEntity,
    LogWeatherEntity,
)
from app.adapters.persistence.story.models import (
    CharacterTemplateEntity,
    LocationEntity,
    WeatherRuleEntity,
)
from app.core.ports.match.event_ports import MSG_EVENT_EXECUTED


_TYPE_WEATHER = "WEATHER"
_TYPE_MOVEMENT = "MOVEMENT"
_TYPE_SLEEP = "SLEEP"
_TYPE_CLOCK_ADVANCE = "CLOCK_ADVANCE"
_TYPE_RECOVERY = "RECOVERY"
_TYPE_EVENT = "EVENT"
_MSG_SLEEP = "ACTION_SLEEP"

DEFAULT_LIMIT = 50
MAX_LIMIT = 200
_CURSOR_PREFIX = "offset:"


def clamp_limit(limit: Optional[int]) -> int:
    """Clamps the requested page size into [1, MAX_LIMIT]; None → DEFAULT_LIMIT."""
    if limit is None:
        return DEFAULT_LIMIT
    return max(1, min(int(limit), MAX_LIMIT))


def encode_cursor(offset: int) -> str:
    """Encodes the offset of the next page into an opaque url-safe token."""
    raw = f"{_CURSOR_PREFIX}{offset}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor: Optional[str]) -> int:
    """Decodes an opaque cursor into an offset. Unreadable cursors restart from 0."""
    if not cursor or not cursor.strip():
        return 0
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
        if not raw.startswith(_CURSOR_PREFIX):
            return 0
        return max(0, int(raw[len(_CURSOR_PREFIX):]))
    except (ValueError, TypeError):
        return 0


class MatchLogsService:
    def __init__(self, session_factory, content_query_service=None) -> None:
        self.session_factory = session_factory
        # Optional: without it the entries keep their ids but carry no cards.
        self.content_query_service = content_query_service

    def get_match_logs(self, uuid_match: str, user_uuid: str, lang: str = "en",
                       limit: Optional[int] = None,
                       cursor: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Returns one page of logs if the user owns the match, else None (→ 404)."""
        with self.session_factory() as session:
            match = (session.query(GamingMatchEntity)
                     .filter(GamingMatchEntity.uuid == uuid_match).first())
            if match is None:
                return None
            # Resolve user id for ownership check
            try:
                from app.adapters.persistence.auth.models import User as UserEntity
                user = session.query(UserEntity).filter(UserEntity.uuid == user_uuid).first()
                if user is None or user.id != match.id_user_creator:
                    return None
            except Exception:
                return None
            return self._build_result(session, match, lang, limit, cursor)

    def get_match_logs_for_admin(self, uuid_match: str, lang: str = "en",
                                 limit: Optional[int] = None,
                                 cursor: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Admin variant — no ownership check. Returns None when match is unknown."""
        with self.session_factory() as session:
            match = (session.query(GamingMatchEntity)
                     .filter(GamingMatchEntity.uuid == uuid_match).first())
            if match is None:
                return None
            return self._build_result(session, match, lang, limit, cursor)

    # ── internal ─────────────────────────────────────────────────────────────

    def _build_result(self, session, match, lang, limit, cursor) -> Dict[str, Any]:
        entries = self._assemble_timeline(session, match)

        effective_limit = clamp_limit(limit)
        offset = min(decode_cursor(cursor), len(entries))
        end = min(offset + effective_limit, len(entries))
        page = self._enrich(session, entries[offset:end], match, lang or "en")

        return {
            "matchUuid": match.uuid,
            "currentClock": match.current_clock or 0,
            "logs": page,
            "nextCursor": encode_cursor(end) if end < len(entries) else None,
            "limit": effective_limit,
            "total": len(entries),
        }

    def _assemble_timeline(self, session, match) -> List[Dict[str, Any]]:
        """The whole timeline, sorted by timestamp ascending, with no enrichment yet."""
        entries: List[Dict[str, Any]] = []

        for w in (session.query(LogWeatherEntity)
                  .filter(LogWeatherEntity.id_match == match.id)
                  .order_by(LogWeatherEntity.clock.asc()).all()):
            entries.append({
                "type": _TYPE_WEATHER,
                "clock": w.clock,
                "timestamp": w.timestamp_start,
                "idWeather": w.id_weather,
            })

        for m in (session.query(LogMovementEntity)
                  .filter(LogMovementEntity.id_match == match.id)
                  .order_by(LogMovementEntity.id.asc()).all()):
            entries.append({
                "type": _TYPE_MOVEMENT,
                "clock": None,
                "timestamp": m.ts_insert,
                "idCharacterMatch": m.id_character_match,
                "idLocationFrom": m.id_location_from,
                "idLocationTo": m.id_location_to,
                "energyCost": m.energy_cost,
            })

        for c in (session.query(LogClockHistoryEntity)
                  .filter(LogClockHistoryEntity.id_match == match.id)
                  .order_by(LogClockHistoryEntity.clock.asc()).all()):
            entries.append({
                "type": _TYPE_CLOCK_ADVANCE,
                "clock": c.clock,
                "timestamp": c.timestamp_start,
            })

        for e in (session.query(LogEventsEntity)
                  .filter(LogEventsEntity.id_match == match.id)
                  .order_by(LogEventsEntity.id.asc()).all()):
            msg = e.log_message
            if msg is None:
                continue
            if msg == _MSG_SLEEP:
                entries.append({
                    "type": _TYPE_SLEEP,
                    "clock": e.clock,
                    "timestamp": e.timestamp,
                    "idCharacterMatch": e.id_character_match,
                })
            elif msg.startswith(MSG_EVENT_EXECUTED):
                entries.append({
                    "type": _TYPE_EVENT,
                    "clock": e.clock,
                    "timestamp": e.timestamp,
                    "idCharacterMatch": e.id_character_match,
                    "message": msg,
                })
            elif msg.startswith("recovery") or msg.startswith("counter"):
                entries.append({
                    "type": _TYPE_RECOVERY,
                    "clock": e.clock,
                    "timestamp": e.timestamp,
                    "idCharacterMatch": e.id_character_match,
                    "message": msg,
                })

        # Sort by timestamp ascending; None timestamps sort last
        entries.sort(key=lambda x: x.get("timestamp") or "9999")
        return entries

    def _enrich(self, session, page, match, lang) -> List[Dict[str, Any]]:
        """Adds the card of every WEATHER (its own) and MOVEMENT entry (the destination
        location's), plus the uuid/name of the character behind character-scoped entries.
        The lookups below run once per page, never once per entry."""
        if not page:
            return []

        weather_cards = {w.id: w.id_card for w in session.query(WeatherRuleEntity)
                         .filter(WeatherRuleEntity.id_story == match.id_story).all()}
        location_cards = {loc.id: loc.id_card for loc in session.query(LocationEntity)
                          .filter(LocationEntity.id_story == match.id_story).all()}
        template_cards = {t.id_tipo: t.id_card for t in session.query(CharacterTemplateEntity)
                          .filter(CharacterTemplateEntity.id_story == match.id_story).all()}
        characters = {c.id: c for c in session.query(GamingCharacterInstanceEntity)
                      .filter(GamingCharacterInstanceEntity.id_match == match.id).all()}

        out: List[Dict[str, Any]] = []
        for e in page:
            entry = dict(e)

            id_card = None
            if entry["type"] == _TYPE_WEATHER and entry.get("idWeather") is not None:
                id_card = weather_cards.get(entry["idWeather"])
            elif entry["type"] == _TYPE_MOVEMENT and entry.get("idLocationTo") is not None:
                id_card = location_cards.get(entry["idLocationTo"])
            entry["idCard"] = id_card
            entry["card"] = self._resolve_card(match.id_story, id_card, lang)

            character = characters.get(entry.get("idCharacterMatch"))
            if character is not None:
                entry["characterUuid"] = character.uuid
                template_card = self._resolve_card(
                    match.id_story, template_cards.get(character.id_character_template), lang)
                entry["characterName"] = template_card.get("title") if template_card else None

            out.append(entry)
        return out

    def _resolve_card(self, story_id, id_card, lang) -> Optional[Dict[str, Any]]:
        """Localized card for a story-scoped card id; None-safe on service and id."""
        if self.content_query_service is None or id_card is None:
            return None
        resolved = self.content_query_service.get_card_by_story_id_and_card_id(
            story_id, id_card, lang)
        return asdict(resolved) if resolved is not None else None
