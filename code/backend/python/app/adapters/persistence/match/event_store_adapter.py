"""Step 29 — SQLAlchemy adapter for the normal-event engine.

This is the first writer of gaming_inventory_items, the first to upsert a single
gaming_state_registry key, the first to add or remove a trait after join, and the first to
ever set is_coma = 1.

The match-scoped tables have a composite (id, id_match) primary key whose id is allocated
by the application, so a new row takes the match-wide max plus one — never a global max and
never a row count (which would collide after a delete).
"""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.adapters.persistence.match.models import (
    GamingBackpackResourcesEntity, GamingCharacterInstanceEntity, GamingCharacterTraitsEntity,
    GamingInventoryItemsEntity, GamingMatchEntity, GamingStateRegistryEntity,
    GamingStoryProgressEntity, LogChoicesExecutedEntity, LogEventsEntity, LogMovementEntity,
)
from app.adapters.persistence.story.models import (
    ChoiceConditionEntity, ChoiceEffectEntity, ChoiceEntity, EventEffectEntity, EventEntity,
    ItemEntity, LocationEntity, StoryEntity, TextEntity, TraitEntity,
)
from app.core.models.match.event_models import EventCheckContext
from app.core.ports.match.event_ports import MSG_EVENT_EXECUTED, EventStorePort
from app.adapters.persistence.auth.models import User


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_id(session, entity, id_match: int) -> int:
    rows = session.query(entity.id).filter(entity.id_match == id_match).all()
    ids = [r[0] for r in rows if r[0] is not None]
    return (max(ids) if ids else 0) + 1


class EventStoreAdapter(EventStorePort):

    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    # ── resolve ─────────────────────────────────────────────────────────────

    def find_user_id_by_uuid(self, user_uuid: str) -> Optional[int]:
        with self.session_factory() as session:
            row = session.query(User).filter(User.uuid == user_uuid).first()
            return row.id if row else None

    def find_match_for_event(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.uuid == match_uuid).first()
            return _match_dict(m)

    def find_match_by_id(self, id_match: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.id == id_match).first()
            return _match_dict(m)

    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            c = session.query(GamingCharacterInstanceEntity).filter(
                GamingCharacterInstanceEntity.id_match == id_match,
                GamingCharacterInstanceEntity.id_user == id_user).first()
            return _character_dict(c) if c else None

    def find_character_by_match_and_id(self, id_match: int,
                                       id_character: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            c = session.query(GamingCharacterInstanceEntity).filter(
                GamingCharacterInstanceEntity.id_match == id_match,
                GamingCharacterInstanceEntity.id == id_character).first()
            return _character_dict(c) if c else None

    def find_characters_for_event(self, id_match: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = session.query(GamingCharacterInstanceEntity).filter(
                GamingCharacterInstanceEntity.id_match == id_match).all()
            return [_character_dict(c) for c in rows]

    def find_backpack(self, id_match: int, id_character: int) -> Dict[str, int]:
        with self.session_factory() as session:
            b = session.query(GamingBackpackResourcesEntity).filter(
                GamingBackpackResourcesEntity.id_match == id_match,
                GamingBackpackResourcesEntity.id_character_match == id_character).first()
            if not b:
                return {"food": 0, "magic": 0, "coin": 0}
            return {"food": b.food or 0, "magic": b.magic or 0, "coin": b.coin or 0}

    # ── story reads ─────────────────────────────────────────────────────────

    def find_event_by_story_and_uuid(self, id_story: int,
                                     event_uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            e = session.query(EventEntity).filter(
                EventEntity.id_story == id_story, EventEntity.uuid == event_uuid).first()
            return _event_dict(e) if e else None

    def find_events_by_id(self, id_story: int) -> Dict[int, Dict[str, Any]]:
        with self.session_factory() as session:
            rows = session.query(EventEntity).filter(EventEntity.id_story == id_story).all()
            return {e.id: _event_dict(e) for e in rows if e.id is not None}

    def find_effects_by_event_id(self, id_story: int) -> Dict[int, List[Dict[str, Any]]]:
        with self.session_factory() as session:
            rows = (session.query(EventEffectEntity)
                    .filter(EventEffectEntity.id_story == id_story)
                    # Authored order: a later effect can build on an earlier one.
                    .order_by(EventEffectEntity.id).all())
            out: Dict[int, List[Dict[str, Any]]] = {}
            for ef in rows:
                if ef.id_event is not None:
                    out.setdefault(ef.id_event, []).append(_effect_dict(ef))
            return out

    def find_id_event_end_game(self, id_story: int) -> Optional[int]:
        with self.session_factory() as session:
            s = session.query(StoryEntity).filter(StoryEntity.id == id_story).first()
            return s.id_event_end_game if s else None

    def find_id_event_all_player_coma(self, id_story: int) -> Optional[int]:
        with self.session_factory() as session:
            s = session.query(StoryEntity).filter(StoryEntity.id == id_story).first()
            return s.id_event_all_player_coma if s else None

    def find_item_uuids_by_id(self, id_story: int) -> Dict[int, str]:
        with self.session_factory() as session:
            rows = session.query(ItemEntity).filter(ItemEntity.id_story == id_story).all()
            return {i.id: i.uuid for i in rows if i.id is not None}

    def find_trait_stats_by_id(self, id_story: int) -> Dict[int, Dict[str, int]]:
        # v0.35.2 — one query for the story, like the uuid map beside it: an execution
        # carries a handful of trait changes and must not pay a query for each.
        with self.session_factory() as session:
            rows = session.query(TraitEntity).filter(TraitEntity.id_story == id_story).all()
            return {t.id: {"life": t.life or 0, "energy": t.energy or 0, "sad": t.sad or 0,
                           "dexterity": t.dexterity or 0, "intelligence": t.intelligence or 0,
                           "constitution": t.constitution or 0, "weight": t.weight or 0}
                    for t in rows if t.id is not None}

    def find_trait_uuids_by_id(self, id_story: int) -> Dict[int, str]:
        with self.session_factory() as session:
            rows = session.query(TraitEntity).filter(TraitEntity.id_story == id_story).all()
            return {t.id: t.uuid for t in rows if t.id is not None}

    def find_location_uuids_by_id(self, id_story: int) -> Dict[int, str]:
        with self.session_factory() as session:
            rows = session.query(LocationEntity).filter(
                LocationEntity.id_story == id_story).all()
            return {l.id: l.uuid for l in rows if l.id is not None}

    # ── the check context ───────────────────────────────────────────────────

    def load_check_context(self, id_match: int,
                           id_character: Optional[int]) -> EventCheckContext:
        if id_character is None:
            return EventCheckContext.no_character()
        with self.session_factory() as session:
            c = session.query(GamingCharacterInstanceEntity).filter(
                GamingCharacterInstanceEntity.id_match == id_match,
                GamingCharacterInstanceEntity.id == id_character).first()
            if not c:
                return EventCheckContext.no_character()

            b = session.query(GamingBackpackResourcesEntity).filter(
                GamingBackpackResourcesEntity.id_match == id_match,
                GamingBackpackResourcesEntity.id_character_match == id_character).first()

            owned = {
                i.id_item for i in session.query(GamingInventoryItemsEntity).filter(
                    GamingInventoryItemsEntity.id_match == id_match,
                    GamingInventoryItemsEntity.id_character_match == id_character).all()
                if i.id_item is not None and (i.amount or 0) > 0
            }

            registry = {
                r.key: _registry_value(r)
                for r in session.query(GamingStateRegistryEntity).filter(
                    GamingStateRegistryEntity.id_match == id_match).all()
                if r.key
            }

            m = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.id == id_match).first()

            return EventCheckContext(
                id_character=id_character,
                id_location=c.id_location,
                sleeping=bool(c.is_sleeping),
                coma=bool(c.is_coma),
                energy=c.energy or 0,
                # One read, three resources: the row was already fetched for the coin cost.
                coin=(b.coin or 0) if b else 0,
                food=(b.food or 0) if b else 0,
                magic=(b.magic or 0) if b else 0,
                id_class=c.id_class,
                owned_item_ids=owned,
                current_weather_id=m.id_current_weather if m else None,
                consumed_event_ids=self._consumed_event_ids(session, id_match),
                registry=registry,
            )

    @staticmethod
    def _consumed_event_ids(session, id_match: int) -> set:
        """The ONCE events already spent in this match.

        Only rows written by an actual execution count: log_counter_zero (Step 26) and the
        weather engine (Step 27) also stamp id_event on log_events rows — for events that
        merely got REFERENCED, never run. Trusting id_event alone would burn a ONCE event
        the player never triggered, so the scan is anchored on the EVENT_EXECUTED marker.
        """
        rows = session.query(LogEventsEntity).filter(
            LogEventsEntity.id_match == id_match).all()
        return {
            r.id_event for r in rows
            if r.id_event is not None and (r.log_message or "").startswith(MSG_EVENT_EXECUTED)
        }

    # ── writes ──────────────────────────────────────────────────────────────

    def update_character_stats(self, id_match: int, id_character: int,
                               stats: Dict[str, int]) -> None:
        with self.session_factory() as session:
            c = session.query(GamingCharacterInstanceEntity).filter(
                GamingCharacterInstanceEntity.id_match == id_match,
                GamingCharacterInstanceEntity.id == id_character).first()
            if not c:
                return
            for field, value in stats.items():
                setattr(c, field, value)
            c.ts_update = _now_iso()
            session.commit()

    def update_backpack(self, id_match: int, id_character: int,
                        resources: Dict[str, int]) -> None:
        with self.session_factory() as session:
            b = session.query(GamingBackpackResourcesEntity).filter(
                GamingBackpackResourcesEntity.id_match == id_match,
                GamingBackpackResourcesEntity.id_character_match == id_character).first()
            if not b:
                return
            b.food = resources.get("food", b.food)
            b.magic = resources.get("magic", b.magic)
            b.coin = resources.get("coin", b.coin)
            b.ts_update = _now_iso()
            session.commit()

    def set_character_characteristics(self, id_match: int, id_character: int,
                                      csv: Optional[str]) -> None:
        with self.session_factory() as session:
            c = session.query(GamingCharacterInstanceEntity).filter(
                GamingCharacterInstanceEntity.id_match == id_match,
                GamingCharacterInstanceEntity.id == id_character).first()
            if not c:
                return
            c.characteristics = csv
            c.ts_update = _now_iso()
            session.commit()

    def add_item(self, id_match: int, id_character: int, id_item: int,
                 max_per_character: Optional[int] = None) -> bool:
        cap = max_per_character or 0
        with self.session_factory() as session:
            rows = session.query(GamingInventoryItemsEntity).filter(
                GamingInventoryItemsEntity.id_match == id_match,
                GamingInventoryItemsEntity.id_character_match == id_character,
                GamingInventoryItemsEntity.id_item == id_item).order_by(
                GamingInventoryItemsEntity.id.asc()).all()
            now = _now_iso()
            if rows:
                # v0.35.1 — the schema holds one row per (character, item); a database
                # written before it did may still carry a pair, and the two amounts have to
                # become one before the cap can mean anything.
                row = rows[0]
                for extra in rows[1:]:
                    row.amount = (row.amount or 0) + (extra.amount or 0)
                    session.delete(extra)
                if 0 < cap < (row.amount or 0) + 1:
                    # Already at the cap: refused, and the caller says so in the payload
                    # rather than failing the event that asked.
                    session.commit()
                    return False
                row.amount = (row.amount or 0) + 1
                row.ts_update = now
                session.commit()
                return True
            session.add(GamingInventoryItemsEntity(
                id=_next_id(session, GamingInventoryItemsEntity, id_match),
                id_match=id_match, uuid=str(uuid_lib.uuid4()),
                id_character_match=id_character, id_item=id_item, amount=1,
                ts_insert=now, ts_update=now))
            session.commit()
            return True

    def find_item_max_per_character_by_id(self, id_story: int) -> Dict[int, Optional[int]]:
        with self.session_factory() as session:
            rows = session.query(ItemEntity).filter(ItemEntity.id_story == id_story).all()
            return {r.id: r.max_per_character for r in rows}

    def remove_item(self, id_match: int, id_character: int, id_item: int) -> bool:
        with self.session_factory() as session:
            # v0.35.1 — every unit goes, however many rows a pre-0.35.1 database spread
            # them over. "The story takes it away from you" never meant "takes one".
            rows = session.query(GamingInventoryItemsEntity).filter(
                GamingInventoryItemsEntity.id_match == id_match,
                GamingInventoryItemsEntity.id_character_match == id_character,
                GamingInventoryItemsEntity.id_item == id_item).all()
            if not rows:
                return False
            for row in rows:
                session.delete(row)
            session.commit()
            return True

    def add_trait(self, id_match: int, id_character: int, id_trait: int,
                  id_event: Optional[int]) -> bool:
        with self.session_factory() as session:
            existing = session.query(GamingCharacterTraitsEntity).filter(
                GamingCharacterTraitsEntity.id_match == id_match,
                GamingCharacterTraitsEntity.id_character_match == id_character,
                GamingCharacterTraitsEntity.id_traits == id_trait).first()
            if existing:
                return False
            now = _now_iso()
            session.add(GamingCharacterTraitsEntity(
                id=_next_id(session, GamingCharacterTraitsEntity, id_match),
                id_match=id_match, uuid=str(uuid_lib.uuid4()),
                id_character_match=id_character, id_traits=id_trait, id_event=id_event,
                ts_insert=now, ts_update=now))
            session.commit()
            return True

    def remove_trait(self, id_match: int, id_character: int, id_trait: int) -> bool:
        with self.session_factory() as session:
            row = session.query(GamingCharacterTraitsEntity).filter(
                GamingCharacterTraitsEntity.id_match == id_match,
                GamingCharacterTraitsEntity.id_character_match == id_character,
                GamingCharacterTraitsEntity.id_traits == id_trait).first()
            if not row:
                return False
            session.delete(row)
            session.commit()
            return True

    def upsert_registry(self, id_match: int, key: str, value: Optional[str],
                        id_character: Optional[int], id_event: Optional[int],
                        clock: int) -> None:
        if not key or not str(key).strip():
            return
        with self.session_factory() as session:
            row = session.query(GamingStateRegistryEntity).filter(
                GamingStateRegistryEntity.id_match == id_match,
                GamingStateRegistryEntity.key == key).first()
            now = _now_iso()
            if not row:
                row = GamingStateRegistryEntity(
                    id=_next_id(session, GamingStateRegistryEntity, id_match),
                    id_match=id_match, uuid=str(uuid_lib.uuid4()), key=key,
                    ts_insert=now, ts_update=now)
                session.add(row)
            _apply_registry_value(row, value)
            row.id_character = id_character
            row.id_event = id_event
            row.clock = clock
            row.ts_update = now
            session.commit()

    def set_current_weather(self, id_match: int, id_weather: Optional[int]) -> None:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.id == id_match).first()
            if not m:
                return
            m.id_current_weather = id_weather
            session.commit()

    def update_character_location(self, id_match: int, id_character: int,
                                  id_location: int) -> None:
        with self.session_factory() as session:
            c = session.query(GamingCharacterInstanceEntity).filter(
                GamingCharacterInstanceEntity.id_match == id_match,
                GamingCharacterInstanceEntity.id == id_character).first()
            if not c:
                return
            c.id_location = id_location
            session.commit()

    def insert_movement_log(self, id_match: int, id_character: int,
                            from_location: Optional[int], to_location: int,
                            energy_cost: int, food_cost: int = 0,
                            magic_cost: int = 0, coin_cost: int = 0) -> None:
        with self.session_factory() as session:
            max_id = session.query(LogMovementEntity.id).order_by(
                LogMovementEntity.id.desc()).first()
            now = _now_iso()
            session.add(LogMovementEntity(
                id=((max_id[0] if max_id else 0) or 0) + 1,
                id_match=id_match, uuid=str(uuid_lib.uuid4()),
                id_character_match=id_character,
                id_location_from=from_location, id_location_to=to_location,
                energy_cost=energy_cost, food_cost=food_cost,
                magic_cost=magic_cost, coin_cost=coin_cost,
                timestamp_start=now, ts_insert=now, ts_update=now))
            session.commit()

    def log_event_executed(self, id_match: int, id_character: Optional[int], id_event: int,
                           clock: int, message: str, energy_cost: int = 0,
                           food_cost: int = 0, magic_cost: int = 0,
                           coin_cost: int = 0) -> None:
        with self.session_factory() as session:
            max_id = session.query(LogEventsEntity.id).order_by(
                LogEventsEntity.id.desc()).first()
            now = _now_iso()
            session.add(LogEventsEntity(
                id=((max_id[0] if max_id else 0) or 0) + 1,
                id_match=id_match, uuid=str(uuid_lib.uuid4()),
                id_character_match=id_character, id_event=id_event, clock=clock,
                log_message=message, timestamp=now, ts_insert=now, ts_update=now,
                energy_cost=energy_cost, food_cost=food_cost,
                magic_cost=magic_cost, coin_cost=coin_cost))
            session.commit()

    # ── choices (Step 31) ───────────────────────────────────────────────────

    def find_choices_by_event_id(self, id_story: int, id_event: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = session.query(ChoiceEntity).filter(
                ChoiceEntity.id_story == id_story,
                ChoiceEntity.id_event == id_event).all()
            return [_choice_dict(c) for c in rows]

    def find_choice_conditions_by_choice_id(self, id_story: int) -> Dict[int, List[Dict[str, Any]]]:
        with self.session_factory() as session:
            rows = session.query(ChoiceConditionEntity).filter(
                ChoiceConditionEntity.id_story == id_story).all()
            # Ordered by row id: under AND the FIRST failing row names the reason the
            # player sees, so it must not depend on the read order.
            rows.sort(key=lambda r: r.id or 0)
            out: Dict[int, List[Dict[str, Any]]] = {}
            for r in rows:
                if r.id_choice is None:
                    continue
                out.setdefault(r.id_choice, []).append({
                    "type": r.condition_type, "key": r.condition_key,
                    "value": r.condition_value, "operator": r.condition_operator,
                })
            return out

    def count_log_markers(self, id_match: int, id_event: int, prefix: str) -> int:
        with self.session_factory() as session:
            rows = session.query(LogEventsEntity).filter(
                LogEventsEntity.id_match == id_match,
                LogEventsEntity.id_event == id_event).all()
            return sum(1 for r in rows if (r.log_message or "").startswith(prefix))

    def find_trait_ids_by_character(self, id_match: int, id_character: int) -> set:
        with self.session_factory() as session:
            rows = session.query(GamingCharacterTraitsEntity).filter(
                GamingCharacterTraitsEntity.id_match == id_match,
                GamingCharacterTraitsEntity.id_character_match == id_character).all()
            return {r.id_traits for r in rows if r.id_traits is not None}

    def resolve_short_text(self, id_story: int, id_text: Optional[int],
                           lang: str) -> Optional[str]:
        if id_text is None:
            return None
        effective = lang if lang else "en"
        with self.session_factory() as session:
            row = session.query(TextEntity).filter(
                TextEntity.id_story == id_story, TextEntity.id_text == id_text,
                TextEntity.lang == effective).first()
            if row is None and effective != "en":
                row = session.query(TextEntity).filter(
                    TextEntity.id_story == id_story, TextEntity.id_text == id_text,
                    TextEntity.lang == "en").first()
            return row.short_text if row else None

    # ── choice resolution (Step 32) ─────────────────────────────────────────

    def find_choice_by_story_and_uuid(self, id_story: int,
                                      choice_uuid: str) -> Optional[Dict[str, Any]]:
        if not choice_uuid or not choice_uuid.strip():
            return None
        with self.session_factory() as session:
            row = session.query(ChoiceEntity).filter(
                ChoiceEntity.id_story == id_story,
                ChoiceEntity.uuid == choice_uuid).first()
            return _choice_dict(row) if row else None

    def find_choice_effects_by_choice_id(self, id_story: int,
                                         id_choice: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = session.query(ChoiceEffectEntity).filter(
                ChoiceEffectEntity.id_story == id_story,
                ChoiceEffectEntity.id_choice == id_choice).all()
            # Authored order: a later row builds on what an earlier one wrote.
            rows.sort(key=lambda r: r.id or 0)
            return [_choice_effect_dict(r) for r in rows]

    def log_choice_executed(self, id_match: int, id_event: int, id_choice: int,
                            clock: int, message: str) -> None:
        with self.session_factory() as session:
            max_id = session.query(LogChoicesExecutedEntity.id).order_by(
                LogChoicesExecutedEntity.id.desc()).first()
            now = _now_iso()
            session.add(LogChoicesExecutedEntity(
                id=((max_id[0] if max_id else 0) or 0) + 1,
                id_match=id_match, uuid=str(uuid_lib.uuid4()),
                id_event=id_event, id_choise=id_choice, clock=clock,
                log_message=message, ts_insert=now, ts_update=now))
            session.commit()

    def insert_story_progress(self, id_match: int, id_event: int, id_choice: int,
                              clock: int) -> None:
        with self.session_factory() as session:
            # Match-wide max + 1: the key is (id, id_match), so ids restart per match.
            max_id = session.query(GamingStoryProgressEntity.id).filter(
                GamingStoryProgressEntity.id_match == id_match).order_by(
                GamingStoryProgressEntity.id.desc()).first()
            now = _now_iso()
            session.add(GamingStoryProgressEntity(
                id=((max_id[0] if max_id else 0) or 0) + 1,
                id_match=id_match, uuid=str(uuid_lib.uuid4()),
                id_event=id_event, id_choise=id_choice, clock=clock,
                ts_insert=now, ts_update=now))
            session.commit()


# ── mappers ─────────────────────────────────────────────────────────────────

def _match_dict(m):
    """Shared by find_match_for_event (by uuid) and find_match_by_id (Step 33)."""
    if not m:
        return None
    return {
        "id": m.id, "uuid": m.uuid, "status": m.status,
        "current_clock": m.current_clock or 0, "id_story": m.id_story,
        "id_user_creator": m.id_user_creator,
        "id_current_weather": m.id_current_weather,
    }


def _character_dict(c: GamingCharacterInstanceEntity) -> Dict[str, Any]:
    return {
        "id": c.id, "uuid": c.uuid, "id_user": c.id_user, "id_class": c.id_class,
        "id_location": c.id_location,
        "dexterity": c.dexterity or 0, "intelligence": c.intelligence or 0,
        "constitution": c.constitution or 0, "energy": c.energy or 0,
        "life": c.life or 0, "sad": c.sad or 0, "exp": c.exp or 0,
        "energy_max": c.energy_max or 0, "life_max": c.life_max or 0,
        # v0.35.2 — weight_max joins the three: a trait's weight delta moves it too.
        "sad_max": c.sad_max or 0, "weight_max": c.weight_max or 0,
        "is_sleeping": bool(c.is_sleeping), "is_coma": bool(c.is_coma),
        "characteristics": c.characteristics,
    }


def _choice_dict(c: ChoiceEntity) -> Dict[str, Any]:
    """The canonical choice shape of the port: DB column names stay in here."""
    return {
        "id": c.id, "uuid": c.uuid, "id_event": c.id_event, "id_card": c.id_card,
        "priority": c.priority, "id_text_name": c.id_text_name,
        "id_text_description": c.id_text_description,
        "otherwise_flag": c.is_otherwise, "is_progress": c.is_progress,
        "logic_operator": c.logic_operator,
        # Step 32 — the narrative the resolution reveals, and the outcome event it runs.
        "id_text_narrative": c.id_text_narrative, "id_event_torun": c.id_event_torun,
        "limit_sad": c.limit_sad, "limit_dex": c.limit_dex,
        "limit_int": c.limit_int, "limit_cos": c.limit_cos,
    }


def _choice_effect_dict(e: ChoiceEffectEntity) -> Dict[str, Any]:
    """Step 32 — the canonical effect shape. Deliberately the same key names the event
    effects use, so _apply_stat / _apply_item / _apply_movement read either table."""
    return {
        "id": e.id, "uuid": e.uuid, "id_card": e.id_card,
        "statistics": e.statistics, "value": e.value, "flag_group": e.flag_group,
        "key": e.key, "value_to_add": e.value_to_add, "value_to_remove": e.value_to_remove,
        "id_event": e.id_event, "id_location": e.id_location, "id_weather": e.id_weather,
        "id_item_target": e.id_item_target, "item_action": e.item_action,
    }


def _event_dict(e: EventEntity) -> Dict[str, Any]:
    return {
        "id": e.id, "uuid": e.uuid, "type": e.type, "id_card": e.id_card,
        "cost_enery": e.cost_enery or 0, "cost_coin": e.cost_coin or 0,
        "cost_food": e.cost_food or 0, "cost_magic": e.cost_magic or 0,
        "flag_end_time": e.flag_end_time or 0, "id_event_next": e.id_event_next,
        "id_specific_location": e.id_specific_location, "id_weather": e.id_weather,
        "registry_key_condition": e.registry_key_condition,
        "registry_value_condition": e.registry_value_condition,
        "id_item_condition": e.id_item_condition,
        "id_class_condition": e.id_class_condition,
    }


def _effect_dict(ef: EventEffectEntity) -> Dict[str, Any]:
    return {
        "id": ef.id, "uuid": ef.uuid, "id_card": ef.id_card, "id_event": ef.id_event,
        "statistics": ef.statistics, "value": ef.value or 0, "target": ef.target,
        "target_class": ef.target_class,
        "traits_to_add": ef.traits_to_add, "traits_to_remove": ef.traits_to_remove,
        "id_item_target": ef.id_item_target, "item_action": ef.item_action,
        "key_to_add": ef.key_to_add, "key_value_to_add": ef.key_value_to_add,
        "characteristic_to_add": ef.characteristic_to_add,
        "characteristic_to_remove": ef.characteristic_to_remove,
        "id_weather": ef.id_weather,
        "id_location": ef.id_location,
    }


def _registry_value(r: GamingStateRegistryEntity) -> Optional[str]:
    """The string wins, else the int — mirrors the Java reader."""
    if r.string_value is not None:
        return r.string_value
    return None if r.int_value is None else str(r.int_value)


def _apply_registry_value(r: GamingStateRegistryEntity, value: Optional[str]) -> None:
    """A numeric value lands in int_value, anything else in string_value (never both)."""
    if value is None:
        r.string_value = None
        r.int_value = None
        return
    try:
        r.int_value = int(str(value).strip())
        r.string_value = None
    except ValueError:
        r.string_value = value
        r.int_value = None
