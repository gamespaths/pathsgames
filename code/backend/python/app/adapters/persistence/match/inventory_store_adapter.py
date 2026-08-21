"""Step 34 — SQLAlchemy adapter for the inventory and resources service.

Everything the effect engine already owns (stats, backpack writes, traits) stays in
`EventStoreAdapter`; this adapter only reads what an item usage has to decide on, deletes
the consumed row and appends the usage log.
"""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.adapters.persistence.match.models import (
    GamingBackpackResourcesEntity, GamingCharacterInstanceEntity,
    GamingInventoryItemsEntity, GamingMatchEntity, LogItemUsageEntity,
)
from app.adapters.persistence.story.models import ItemEffectEntity, ItemEntity
from app.core.ports.match.inventory_ports import InventoryStorePort


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class InventoryStoreAdapter(InventoryStorePort):

    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    # ── reads ───────────────────────────────────────────────────────────────

    def find_match_by_uuid(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.uuid == match_uuid).first()
            if m is None:
                return None
            return {"id": m.id, "uuid": m.uuid, "status": m.status, "id_story": m.id_story}

    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            c = (session.query(GamingCharacterInstanceEntity)
                 .filter(GamingCharacterInstanceEntity.id_match == id_match)
                 .filter(GamingCharacterInstanceEntity.id_user == id_user)
                 .first())
            if c is None:
                return None
            return {
                "id": c.id,
                "uuid": c.uuid,
                "id_class": c.id_class,
                "is_sleeping": bool(c.is_sleeping),
                "is_coma": bool(c.is_coma),
                "weight_max": c.weight_max or 0,
            }

    def find_inventory(self, id_match: int, id_character: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (session.query(GamingInventoryItemsEntity)
                    .filter(GamingInventoryItemsEntity.id_match == id_match)
                    .filter(GamingInventoryItemsEntity.id_character_match == id_character)
                    .order_by(GamingInventoryItemsEntity.id.asc())
                    .all())
            return [
                {"id": r.id, "uuid": r.uuid, "id_item": r.id_item,
                 "amount": r.amount, "state": r.state}
                for r in rows
            ]

    def find_items_by_id(self, id_story: int) -> Dict[int, Dict[str, Any]]:
        with self.session_factory() as session:
            rows = session.query(ItemEntity).filter(ItemEntity.id_story == id_story).all()
            return {
                r.id: {
                    "id": r.id,
                    "uuid": r.uuid,
                    "weight": r.weight,
                    "id_card": r.id_card,
                    "id_text_name": r.id_text_name,
                    "is_consumabile": r.is_consumabile,
                    "id_class_permitted": r.id_class_permitted,
                    "id_class_prohibited": r.id_class_prohibited,
                }
                for r in rows
            }

    def find_item_effects_by_item_id(self, id_story: int) -> Dict[int, List[Dict[str, Any]]]:
        # One query for the whole story, grouped in memory: an item has a handful of
        # effect rows, and a per-item query would be an N+1 on the listing path.
        with self.session_factory() as session:
            rows = (session.query(ItemEffectEntity)
                    .filter(ItemEffectEntity.id_story == id_story)
                    .order_by(ItemEffectEntity.id.asc())
                    .all())
        grouped: Dict[int, List[Dict[str, Any]]] = {}
        for r in rows:
            if r.id_item is None:
                continue
            grouped.setdefault(r.id_item, []).append({
                "id": r.id,
                "uuid": r.uuid,
                "id_card": r.id_card,
                "effect_code": r.effect_code,
                "effect_value": r.effect_value,
                "traits_to_add": r.traits_to_add,
                "traits_to_remove": r.traits_to_remove,
            })
        return grouped

    def find_backpack(self, id_match: int, id_character: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            b = (session.query(GamingBackpackResourcesEntity)
                 .filter(GamingBackpackResourcesEntity.id_match == id_match)
                 .filter(GamingBackpackResourcesEntity.id_character_match == id_character)
                 .first())
            if b is None:
                return None
            return {"food": b.food or 0, "magic": b.magic or 0, "coin": b.coin or 0}

    # ── writes ──────────────────────────────────────────────────────────────

    def delete_inventory_row(self, id_match: int, id_row: int) -> None:
        with self.session_factory() as session:
            (session.query(GamingInventoryItemsEntity)
             .filter(GamingInventoryItemsEntity.id_match == id_match)
             .filter(GamingInventoryItemsEntity.id == id_row)
             .delete())
            session.commit()

    def log_item_usage(self, id_match: int, id_character: int, id_item: int,
                       effects_json: str) -> None:
        with self.session_factory() as session:
            # Table-wide max: log_item_usage carries UNIQUE (id), unlike the per-match
            # gaming_* tables. Same rule as log_events.
            max_id = session.query(LogItemUsageEntity.id).order_by(
                LogItemUsageEntity.id.desc()).first()
            now = _now_iso()
            session.add(LogItemUsageEntity(
                id=((max_id[0] if max_id else 0) or 0) + 1,
                id_match=id_match, uuid=str(uuid_lib.uuid4()),
                id_character_match=id_character, id_item=id_item, counter=1,
                effects_json=effects_json, timestamp=now, ts_insert=now, ts_update=now))
            session.commit()
