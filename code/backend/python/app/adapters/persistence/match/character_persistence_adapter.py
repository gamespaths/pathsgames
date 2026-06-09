"""Step 21 — SQLAlchemy adapter for the character instance / backpack / traits tables.

Implements both :class:`CharacterPersistencePort` (write + validation reads) and
:class:`CharacterReadPort` (read side used by the query service and match detail).
"""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.adapters.persistence.match.models import (
    GamingBackpackResourcesEntity,
    GamingCharacterInstanceEntity,
    GamingCharacterTraitsEntity,
)
from app.core.ports.match.match_ports import CharacterPersistencePort, CharacterReadPort


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_uuid() -> str:
    return str(uuid_lib.uuid4())


class CharacterPersistenceAdapter(CharacterPersistencePort, CharacterReadPort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    # ─── write side ──────────────────────────────────────────────────────────

    def save_character(self, row: Dict[str, Any]) -> Dict[str, Any]:
        with self.session_factory() as session:
            now = _now_iso()
            entity = GamingCharacterInstanceEntity(
                id=row["id"],
                id_match=row["id_match"],
                uuid=_new_uuid(),
                id_user=row["id_user"],
                id_character_template=row["id_character_template"],
                dexterity=row.get("dexterity", 1),
                intelligence=row.get("intelligence", 1),
                constitution=row.get("constitution", 1),
                energy=row.get("energy", 0),
                life=row.get("life", 1),
                sad=row.get("sad", 0),
                id_location=row.get("id_location"),
                is_sleeping=row.get("is_sleeping", 0),
                is_coma=row.get("is_coma", 0),
                counter_consecutive_pass=0,
                ts_insert=now,
                ts_update=now,
            )
            session.add(entity)
            session.commit()
            session.refresh(entity)
            return self._character_to_dict(entity)

    def save_backpack(self, row: Dict[str, Any]) -> None:
        if row is None:
            return
        with self.session_factory() as session:
            now = _now_iso()
            entity = GamingBackpackResourcesEntity(
                id=row["id"],
                id_match=row["id_match"],
                uuid=_new_uuid(),
                id_character_match=row["id_character_match"],
                food=row.get("food", 0),
                magic=row.get("magic", 0),
                coin=row.get("coin", 0),
                ts_insert=now,
                ts_update=now,
            )
            session.add(entity)
            session.commit()

    def save_traits(self, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        with self.session_factory() as session:
            now = _now_iso()
            for r in rows:
                session.add(GamingCharacterTraitsEntity(
                    id=r["id"],
                    id_match=r["id_match"],
                    uuid=_new_uuid(),
                    id_character_match=r["id_character_match"],
                    id_traits=r["id_traits"],
                    ts_insert=now,
                    ts_update=now,
                ))
            session.commit()

    def find_character_by_match_and_user(self, match_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        if match_id is None or user_id is None:
            return None
        with self.session_factory() as session:
            entity = (
                session.query(GamingCharacterInstanceEntity)
                .filter(GamingCharacterInstanceEntity.id_match == match_id)
                .filter(GamingCharacterInstanceEntity.id_user == user_id)
                .first()
            )
            return self._character_to_dict(entity) if entity else None

    def count_characters_by_match_id(self, match_id: int) -> int:
        if match_id is None:
            return 0
        with self.session_factory() as session:
            return (
                session.query(GamingCharacterInstanceEntity)
                .filter(GamingCharacterInstanceEntity.id_match == match_id)
                .count()
            )

    # ─── read side ───────────────────────────────────────────────────────────

    def find_characters_by_match_id(self, match_id: int) -> List[Dict[str, Any]]:
        if match_id is None:
            return []
        with self.session_factory() as session:
            rows = (
                session.query(GamingCharacterInstanceEntity)
                .filter(GamingCharacterInstanceEntity.id_match == match_id)
                .all()
            )
            return [self._character_to_dict(r) for r in rows]

    def find_character_by_match_and_uuid(self, match_id: int, uuid: str) -> Optional[Dict[str, Any]]:
        if match_id is None or not uuid:
            return None
        with self.session_factory() as session:
            entity = (
                session.query(GamingCharacterInstanceEntity)
                .filter(GamingCharacterInstanceEntity.id_match == match_id)
                .filter(GamingCharacterInstanceEntity.uuid == uuid)
                .first()
            )
            return self._character_to_dict(entity) if entity else None

    def find_backpack(self, match_id: int, character_id: int) -> Optional[Dict[str, Any]]:
        if match_id is None or character_id is None:
            return None
        with self.session_factory() as session:
            entity = (
                session.query(GamingBackpackResourcesEntity)
                .filter(GamingBackpackResourcesEntity.id_match == match_id)
                .filter(GamingBackpackResourcesEntity.id_character_match == character_id)
                .first()
            )
            if entity is None:
                return None
            return {"food": entity.food, "magic": entity.magic, "coin": entity.coin}

    def find_traits(self, match_id: int, character_id: int) -> List[Dict[str, Any]]:
        if match_id is None or character_id is None:
            return []
        with self.session_factory() as session:
            rows = (
                session.query(GamingCharacterTraitsEntity)
                .filter(GamingCharacterTraitsEntity.id_match == match_id)
                .filter(GamingCharacterTraitsEntity.id_character_match == character_id)
                .all()
            )
            return [{"id_traits": r.id_traits} for r in rows]

    @staticmethod
    def _character_to_dict(entity: GamingCharacterInstanceEntity) -> Dict[str, Any]:
        return {
            "id": entity.id,
            "uuid": entity.uuid,
            "id_match": entity.id_match,
            "id_user": entity.id_user,
            "id_character_template": entity.id_character_template,
            "dexterity": entity.dexterity,
            "intelligence": entity.intelligence,
            "constitution": entity.constitution,
            "energy": entity.energy,
            "life": entity.life,
            "sad": entity.sad,
            "id_location": entity.id_location,
            "is_sleeping": entity.is_sleeping,
            "is_coma": entity.is_coma,
        }
