"""Step 28.7 — match logs service (Python backend).

Returns a consolidated timeline of all logged events for a match:
WEATHER, MOVEMENT, SLEEP, CLOCK_ADVANCE, RECOVERY and, since v0.35.4, the three
ITEM_* actions read off log_item_usage. Sorted by timestamp ascending
by default; `order=desc` flips the whole timeline (newest entry first) before the
page is cut, so the cursor still walks away from the first returned entry. Entries
with no timestamp sit at the end in `asc`, hence at the front in `desc`.

v0.28.7 — the timeline is cursor-paginated (opaque base64 offset token, same envelope
convention as the paginated admin match list) and the entries on the returned page are
enriched: WEATHER carries the weather's card, MOVEMENT carries the destination
location's card, and every character-scoped entry names the character that acted.

v0.30.3 — EVENT entries (Step 29 player-triggered events) carry `idEvent` and the
triggered event's own card, resolved the same way as WEATHER/MOVEMENT. log_events rows
the service does not classify (e.g. the Step 30 edge-state audit messages
`SADNESS_OVERFLOW`/`COMA`) are dropped, not shown as garbage.
"""
import base64
from dataclasses import asdict
from typing import Any, Dict, List, Optional

from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    LogClockHistoryEntity,
    LogEventsEntity,
    LogItemUsageEntity,
    LogMovementEntity,
    LogWeatherEntity,
)
from app.adapters.persistence.story.models import (
    CharacterTemplateEntity,
    EventEntity,
    ItemEntity,
    LocationEntity,
    WeatherRuleEntity,
)
from app.core.ports.match.event_ports import (
    ITEM_ACTION_ADD, ITEM_ACTION_DROP, ITEM_ACTION_REMOVE, ITEM_ACTION_USE,
    MSG_EVENT_EXECUTED,
)


def _item_type(action: Optional[str]) -> Optional[str]:
    """log_item_usage.action to timeline type.

    REMOVE is an effect taking the item away and DROP is the player putting it down: the
    bag ends up the same, so they share one type. An unknown action is dropped, like an
    unknown log message; a row without one predates v0.35.4, when only usages were logged.
    """
    if action is None:
        return _TYPE_ITEM_USE
    normalized = str(action).strip().upper()
    if normalized == ITEM_ACTION_ADD:
        return _TYPE_ITEM_ADD
    if normalized == ITEM_ACTION_USE:
        return _TYPE_ITEM_USE
    if normalized in (ITEM_ACTION_DROP, ITEM_ACTION_REMOVE):
        return _TYPE_ITEM_DROP
    return None


def _split_delta(entry: Dict[str, Any], row) -> None:
    """A signed delta lands on both families: the negative half is a cost, the positive
    half a gain. What an item usage produces, in other words — and it keeps the four
    resources readable by exactly the code that reads an event's price."""
    for name in ("energy", "food", "magic", "coin"):
        value = getattr(row, name, 0) or 0
        entry[f"{name}Cost"] = max(0, -value)
        entry[f"{name}Gain"] = max(0, value)


_TYPE_WEATHER = "WEATHER"
_TYPE_MOVEMENT = "MOVEMENT"
_TYPE_SLEEP = "SLEEP"
_TYPE_CLOCK_ADVANCE = "CLOCK_ADVANCE"
_TYPE_RECOVERY = "RECOVERY"
_TYPE_EVENT = "EVENT"
# Step 33 — a location's counter ran out. Split out of RECOVERY, which it never was.
_TYPE_COUNTER_ZERO = "COUNTER_ZERO"
# Step 33 — an event the engine fired: an arrival, a counter, a time-start.
_TYPE_AUTOMATIC_EVENT = "AUTOMATIC_EVENT"
# v0.35.4 — the three item actions, read off log_item_usage.action rather than a message.
_TYPE_ITEM_ADD = "ITEM_ADD"
_TYPE_ITEM_USE = "ITEM_USE"
_TYPE_ITEM_DROP = "ITEM_DROP"
_MSG_SLEEP = "ACTION_SLEEP"
_MSG_COUNTER = "counter"
_MSG_AUTOMATIC_EVENT = "automatic event"

DEFAULT_LIMIT = 50
MAX_LIMIT = 200
_CURSOR_PREFIX = "offset:"
ORDER_ASC = "asc"
ORDER_DESC = "desc"


def normalize_order(order: Optional[str]) -> str:
    """Only `desc` flips the timeline; anything else (None, junk) keeps `asc`."""
    if order and str(order).strip().lower() == ORDER_DESC:
        return ORDER_DESC
    return ORDER_ASC


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
                       limit: Optional[int] = None, cursor: Optional[str] = None,
                       order: Optional[str] = None) -> Optional[Dict[str, Any]]:
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
            return self._build_result(session, match, lang, limit, cursor, order)

    def get_match_logs_for_admin(self, uuid_match: str, lang: str = "en",
                                 limit: Optional[int] = None, cursor: Optional[str] = None,
                                 order: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Admin variant — no ownership check. Returns None when match is unknown."""
        with self.session_factory() as session:
            match = (session.query(GamingMatchEntity)
                     .filter(GamingMatchEntity.uuid == uuid_match).first())
            if match is None:
                return None
            return self._build_result(session, match, lang, limit, cursor, order)

    # ── internal ─────────────────────────────────────────────────────────────

    def _build_result(self, session, match, lang, limit, cursor, order=None) -> Dict[str, Any]:
        entries = self._assemble_timeline(session, match)
        effective_order = normalize_order(order)
        # Reversed before the page is cut, so the cursor keeps walking away from the
        # first entry: with `desc` "load more" moves towards the older entries.
        if effective_order == ORDER_DESC:
            entries.reverse()

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
            "order": effective_order,
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
                # v0.35.3 — what the move took besides energy; 0 when it took nothing.
                "foodCost": m.food_cost or 0,
                "magicCost": m.magic_cost or 0,
                "coinCost": m.coin_cost or 0,
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
                    "idEvent": e.id_event,
                    # v0.35.3 — the price the actor paid to open this event. Zero on the rows
                    # the engine writes for itself: chained, automatic and resolution rows.
                    "energyCost": e.energy_cost or 0,
                    "foodCost": e.food_cost or 0,
                    "magicCost": e.magic_cost or 0,
                    "coinCost": e.coin_cost or 0,
                    # v0.35.4 — and what the event gave back, on the gain half of the row.
                    "energyGain": e.energy_gain or 0,
                    "foodGain": e.food_gain or 0,
                    "magicGain": e.magic_gain or 0,
                    "coinGain": e.coin_gain or 0,
                })
            elif msg.startswith(_MSG_COUNTER):
                # Step 33 split this out of RECOVERY: a counter running out and a character
                # healing are unrelated events, and the frontend has to tell them apart.
                # The location rides in idLocationTo so it enriches like a MOVEMENT does.
                entries.append({
                    "type": _TYPE_COUNTER_ZERO,
                    "clock": e.clock,
                    "timestamp": e.timestamp,
                    "idCharacterMatch": e.id_character_match,
                    "idLocationTo": e.id_location,
                    "message": msg,
                    "idEvent": e.id_event,
                })
            elif msg.startswith(_MSG_AUTOMATIC_EVENT):
                entries.append({
                    "type": _TYPE_AUTOMATIC_EVENT,
                    "clock": e.clock,
                    "timestamp": e.timestamp,
                    "idCharacterMatch": e.id_character_match,
                    "idLocationTo": e.id_location,
                    "message": msg,
                    "idEvent": e.id_event,
                })
            elif msg.startswith("recovery"):
                entries.append({
                    "type": _TYPE_RECOVERY,
                    "clock": e.clock,
                    "timestamp": e.timestamp,
                    "idCharacterMatch": e.id_character_match,
                    "message": msg,
                })

        # v0.35.4 — the item log. Unlike log_events this table needs no message parsing:
        # the action column says what happened, and an unknown one is dropped the same way.
        for i in (session.query(LogItemUsageEntity)
                  .filter(LogItemUsageEntity.id_match == match.id)
                  .order_by(LogItemUsageEntity.id.asc()).all()):
            entry_type = _item_type(i.action)
            if entry_type is None:
                continue
            entry = {
                "type": entry_type,
                "clock": None,
                "timestamp": i.timestamp,
                "idCharacterMatch": i.id_character_match,
                "idItem": i.id_item,
                "itemAction": i.action,
                "counter": i.counter,
                "idEvent": i.id_event,
            }
            _split_delta(entry, i)
            entries.append(entry)

        # v0.35.4 — every entry carries the eight resource fields, whatever its type, so a
        # client can sum a column without null checks. The Java reference has always
        # answered this shape; the two backends built per-type dicts and left the keys out
        # of the types that move nothing, which made the contract type-dependent.
        for entry in entries:
            for name in ("energy", "food", "magic", "coin"):
                entry.setdefault(f"{name}Cost", 0)
                entry.setdefault(f"{name}Gain", 0)

        # Sort by timestamp ascending; None timestamps sort last
        entries.sort(key=lambda x: x.get("timestamp") or "9999")
        return entries

    def _enrich(self, session, page, match, lang) -> List[Dict[str, Any]]:
        """Adds the card of every WEATHER (its own), MOVEMENT (the destination
        location's) and EVENT entry (the triggered event's own card, v0.30.3), plus the
        uuid/name of the character behind character-scoped entries. The lookups below
        run once per page, never once per entry."""
        if not page:
            return []

        weather_cards = {w.id: w.id_card for w in session.query(WeatherRuleEntity)
                         .filter(WeatherRuleEntity.id_story == match.id_story).all()}
        location_cards = {loc.id: loc.id_card for loc in session.query(LocationEntity)
                          .filter(LocationEntity.id_story == match.id_story).all()}
        template_cards = {t.id_tipo: t.id_card for t in session.query(CharacterTemplateEntity)
                          .filter(CharacterTemplateEntity.id_story == match.id_story).all()}
        event_cards = {ev.id: ev.id_card for ev in session.query(EventEntity)
                       .filter(EventEntity.id_story == match.id_story).all()}
        item_cards = {it.id: it.id_card for it in session.query(ItemEntity)
                      .filter(ItemEntity.id_story == match.id_story).all()}
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
            elif entry["type"] == _TYPE_EVENT and entry.get("idEvent") is not None:
                id_card = event_cards.get(entry["idEvent"])
            elif entry["type"] == _TYPE_AUTOMATIC_EVENT and entry.get("idEvent") is not None:
                # Step 33 — the event's own card, like a player-triggered one.
                id_card = event_cards.get(entry["idEvent"])
            elif entry["type"] == _TYPE_COUNTER_ZERO and entry.get("idLocationTo") is not None:
                # Step 33 — a counter belongs to a place, so the place's card names it.
                id_card = location_cards.get(entry["idLocationTo"])
            elif entry.get("idItem") is not None:
                # v0.35.4 — an item entry is narrated by the item's own card, whichever of
                # the three actions it is.
                id_card = item_cards.get(entry["idItem"])
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
