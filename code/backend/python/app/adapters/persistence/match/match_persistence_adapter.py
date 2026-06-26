"""Step 19 — SQLAlchemy adapter implementing :class:`MatchPersistencePort`."""
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_

from app.adapters.persistence.match.models import (
    GamingBackpackResourcesEntity,
    GamingCharacterInstanceEntity,
    GamingCharacterTraitsEntity,
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
                rng_seed=match.get("rng_seed"),
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

    def find_matches_page(self, status: Optional[str], id_user: Optional[int],
                          id_story: Optional[int], ts_from: Optional[str],
                          ts_cursor: Optional[str], id_cursor: Optional[int],
                          limit: int) -> List[Dict[str, Any]]:
        # v0.28.1 — keyset page of the admin match list. ts_insert is an ISO
        # string, so its lexical order matches chronological order; id is the
        # deterministic tie-breaker. The keyset clause selects the rows strictly
        # older than the previous page's last row, so pages never skip/duplicate.
        with self.session_factory() as session:
            q = session.query(GamingMatchEntity)
            if status is not None:
                q = q.filter(GamingMatchEntity.status == status)
            if id_user is not None:
                q = q.filter(GamingMatchEntity.id_user_creator == id_user)
            if id_story is not None:
                q = q.filter(GamingMatchEntity.id_story == id_story)
            if ts_from is not None:
                q = q.filter(GamingMatchEntity.ts_insert >= ts_from)
            if ts_cursor is not None:
                q = q.filter(
                    or_(
                        GamingMatchEntity.ts_insert < ts_cursor,
                        and_(
                            GamingMatchEntity.ts_insert == ts_cursor,
                            GamingMatchEntity.id < id_cursor,
                        ),
                    )
                )
            rows = (
                q.order_by(GamingMatchEntity.ts_insert.desc(), GamingMatchEntity.id.desc())
                .limit(max(1, limit))
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

    def delete_matches_by_name_like(self, name_like_pattern: str) -> int:
        # Locate the matching matches, remove their derived runtime state
        # (locations + registry) first, then delete the matches themselves.
        with self.session_factory() as session:
            ids = [
                row[0]
                for row in session.query(GamingMatchEntity.id).filter(
                    GamingMatchEntity.name.like(name_like_pattern)
                ).all()
            ]
            if not ids:
                return 0
            self._delete_character_state(session, ids)
            session.query(GamingStateLocationEntity).filter(
                GamingStateLocationEntity.id_match.in_(ids)
            ).delete(synchronize_session=False)
            session.query(GamingStateRegistryEntity).filter(
                GamingStateRegistryEntity.id_match.in_(ids)
            ).delete(synchronize_session=False)
            deleted_count = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.name.like(name_like_pattern)
            ).delete(synchronize_session=False)
            session.commit()
            return deleted_count

    def update_match_fields(self, uuid: str, status: Optional[str], name: Optional[str]) -> bool:
        with self.session_factory() as session:
            entity = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.uuid == uuid
            ).first()
            if entity is None:
                return False
            if status is not None:
                entity.status = status
            if name is not None:
                entity.name = name
            entity.ts_update = _now_iso()
            session.commit()
            return True

    def delete_match_by_uuid(self, uuid: str) -> bool:
        with self.session_factory() as session:
            entity = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.uuid == uuid
            ).first()
            if entity is None:
                return False
            match_id = entity.id
            # Remove the derived runtime state (characters + locations + registry) first.
            self._delete_character_state(session, [match_id])
            session.query(GamingStateLocationEntity).filter(
                GamingStateLocationEntity.id_match == match_id
            ).delete(synchronize_session=False)
            session.query(GamingStateRegistryEntity).filter(
                GamingStateRegistryEntity.id_match == match_id
            ).delete(synchronize_session=False)
            session.delete(entity)
            session.commit()
            return True

    @staticmethod
    def _delete_character_state(session, match_ids: List[int]) -> None:
        """Step 21 — remove per-match character rows (traits, backpack, instances)."""
        session.query(GamingCharacterTraitsEntity).filter(
            GamingCharacterTraitsEntity.id_match.in_(match_ids)
        ).delete(synchronize_session=False)
        session.query(GamingBackpackResourcesEntity).filter(
            GamingBackpackResourcesEntity.id_match.in_(match_ids)
        ).delete(synchronize_session=False)
        session.query(GamingCharacterInstanceEntity).filter(
            GamingCharacterInstanceEntity.id_match.in_(match_ids)
        ).delete(synchronize_session=False)

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
            "rng_seed": entity.rng_seed,
            "ts_insert": entity.ts_insert,
            "ts_update": entity.ts_update,
            "single_player": entity.single_player,
            "character_template_uuid": entity.character_template_uuid,
            "class_uuid": entity.class_uuid,
            "trait_uuids": _split_trait_uuids(entity.trait_uuids),
        }
