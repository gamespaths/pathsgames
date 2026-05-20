"""Step 19 — SQLAlchemy adapter implementing :class:`MatchPersistencePort`."""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.adapters.persistence.match.models import (
    GamingMatchEntity,
    GamingStateLocationEntity,
    GamingStateRegistryEntity,
)
from app.core.ports.match.match_ports import MatchPersistencePort


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_uuid() -> str:
    return str(uuid_lib.uuid4())


def _join_trait_uuids(values) -> Optional[str]:
    """Join trait uuids into the comma-separated gaming_match.trait_uuids column."""
    if not values:
        return None
    cleaned = [str(v).strip() for v in values if v is not None and str(v).strip()]
    return ",".join(cleaned) if cleaned else None


def _split_trait_uuids(csv) -> List[str]:
    """Split the comma-separated gaming_match.trait_uuids column into a list."""
    if not csv:
        return []
    return [p.strip() for p in str(csv).split(",") if p and p.strip()]


class MatchPersistenceAdapter(MatchPersistencePort):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    def save_match(self, match: Dict[str, Any]) -> Dict[str, Any]:
        with self.session_factory() as session:
            now = _now_iso()
            entity = GamingMatchEntity(
                uuid=_new_uuid(),
                id_story=match["id_story"],
                id_difficulty=match["id_difficulty"],
                id_user_creator=match["id_user_creator"],
                name=match.get("name"),
                exp_cost=match.get("exp_cost", 5),
                status=match.get("status", "CREATED"),
                current_clock=match.get("current_clock", 0),
                secure_location_param=match.get("secure_location_param", 0),
                counter_consecutive_pass=match.get("counter_consecutive_pass", 0),
                single_player=match.get("single_player", 1),
                character_template_uuid=match.get("character_template_uuid"),
                class_uuid=match.get("class_uuid"),
                trait_uuids=_join_trait_uuids(match.get("trait_uuids")),
                ts_insert=now,
                ts_update=now,
            )
            session.add(entity)
            session.commit()
            session.refresh(entity)
            return self._match_to_dict(entity)

    def find_match_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            entity = session.query(GamingMatchEntity).filter(GamingMatchEntity.uuid == uuid).first()
            return self._match_to_dict(entity) if entity else None

    def find_matches_by_user_id(self, user_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(GamingMatchEntity)
                .filter(GamingMatchEntity.id_user_creator == user_id)
                .order_by(GamingMatchEntity.ts_insert.desc())
                .all()
            )
            return [self._match_to_dict(r) for r in rows]

    def find_all_matches(self) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(GamingMatchEntity)
                .order_by(GamingMatchEntity.ts_insert.desc())
                .all()
            )
            return [self._match_to_dict(r) for r in rows]

    def save_locations(self, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        with self.session_factory() as session:
            now = _now_iso()
            for r in rows:
                entity = GamingStateLocationEntity(
                    id_match=r["id_match"],
                    id_location=r["id_location"],
                    uuid=_new_uuid(),
                    flag_already_actived=r.get("flag_already_actived", 0),
                    clock_counter=r.get("clock_counter", 0),
                    ts_insert=now,
                    ts_update=now,
                )
                session.add(entity)
            session.commit()

    def save_registry(self, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        with self.session_factory() as session:
            now = _now_iso()
            for r in rows:
                entity = GamingStateRegistryEntity(
                    id=r["id"],
                    id_match=r["id_match"],
                    uuid=_new_uuid(),
                    key=r.get("key", ""),
                    string_value=r.get("string_value"),
                    int_value=r.get("int_value"),
                    ts_insert=now,
                    ts_update=now,
                )
                session.add(entity)
            session.commit()

    def find_locations_by_match_id(self, match_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(GamingStateLocationEntity)
                .filter(GamingStateLocationEntity.id_match == match_id)
                .all()
            )
            return [
                {
                    "id_match": r.id_match,
                    "id_location": r.id_location,
                    "uuid": r.uuid,
                    "flag_already_actived": r.flag_already_actived,
                    "clock_counter": r.clock_counter or 0,
                }
                for r in rows
            ]

    def find_registry_by_match_id(self, match_id: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (
                session.query(GamingStateRegistryEntity)
                .filter(GamingStateRegistryEntity.id_match == match_id)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "id_match": r.id_match,
                    "uuid": r.uuid,
                    "key": r.key,
                    "string_value": r.string_value,
                    "int_value": r.int_value,
                }
                for r in rows
            ]

    @staticmethod
    def _match_to_dict(entity: GamingMatchEntity) -> Dict[str, Any]:
        return {
            "id": entity.id,
            "uuid": entity.uuid,
            "id_story": entity.id_story,
            "id_difficulty": entity.id_difficulty,
            "id_user_creator": entity.id_user_creator,
            "name": entity.name,
            "status": entity.status,
            "current_clock": entity.current_clock or 0,
            "exp_cost": entity.exp_cost or 0,
            "ts_insert": entity.ts_insert,
            "ts_update": entity.ts_update,
            "single_player": entity.single_player,
            "character_template_uuid": entity.character_template_uuid,
            "class_uuid": entity.class_uuid,
            "trait_uuids": _split_trait_uuids(entity.trait_uuids),
        }
