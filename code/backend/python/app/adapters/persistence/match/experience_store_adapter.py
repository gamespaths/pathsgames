"""Step 38 — SQLAlchemy adapter behind use-exp (mirror of the Java ExperienceStoreAdapter)."""
from typing import Any, Dict, Optional

from sqlalchemy import func

from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    LogEventsEntity,
)
from app.adapters.persistence.match.turn_cycle_store_adapter import _new_uuid, _now_iso
from app.adapters.persistence.story.models import LocationEntity, StoryDifficultyEntity
from app.core.ports.match.experience_ports import ExperienceStorePort


class ExperienceStoreAdapter(ExperienceStorePort):
    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    def find_match_by_uuid(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(GamingMatchEntity.uuid == match_uuid).first()
            if m is None:
                return None
            return {
                "id": m.id, "uuid": m.uuid, "status": m.status,
                "id_story": m.id_story, "id_difficulty": m.id_difficulty,
                "exp_cost": m.exp_cost, "current_clock": m.current_clock or 0,
                "id_character_current_turn": m.id_character_current_turn,
            }

    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            c = (session.query(GamingCharacterInstanceEntity)
                 .filter(GamingCharacterInstanceEntity.id_match == id_match,
                         GamingCharacterInstanceEntity.id_user == id_user).first())
            if c is None:
                return None
            return {
                "id": c.id, "uuid": c.uuid,
                "dexterity": c.dexterity or 0, "intelligence": c.intelligence or 0,
                "constitution": c.constitution or 0, "exp": c.exp or 0,
                "is_sleeping": bool(c.is_sleeping), "is_coma": bool(c.is_coma),
                "id_location": c.id_location,
            }

    def find_location_secure_param(self, id_story: int, id_location: int) -> Optional[int]:
        with self.session_factory() as session:
            l = (session.query(LocationEntity)
                 .filter(LocationEntity.id_story == id_story, LocationEntity.id == id_location).first())
            return None if l is None else int(l.secure_param or 0)

    def find_difficulty(self, id_story: int, id_difficulty: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            d = (session.query(StoryDifficultyEntity)
                 .filter(StoryDifficultyEntity.id_story == id_story,
                         StoryDifficultyEntity.id == id_difficulty).first())
            if d is None:
                return None
            return {"exp_cost": d.exp_cost, "exp_cost_base": d.exp_cost_base,
                    "max_stat_value": d.max_stat_value}

    def update_character(self, id_match: int, id_character: int, dexterity: int,
                         intelligence: int, constitution: int, exp: int) -> None:
        with self.session_factory() as session:
            c = (session.query(GamingCharacterInstanceEntity)
                 .filter(GamingCharacterInstanceEntity.id_match == id_match,
                         GamingCharacterInstanceEntity.id == id_character).first())
            if c is None:
                return
            c.dexterity = dexterity
            c.intelligence = intelligence
            c.constitution = constitution
            c.exp = max(0, int(exp))
            c.ts_update = _now_iso()
            session.commit()

    def log_exp_use(self, id_match: int, id_character: int, clock: int, message: str) -> None:
        with self.session_factory() as session:
            max_id = session.query(func.max(LogEventsEntity.id)).scalar() or 0
            now = _now_iso()
            session.add(LogEventsEntity(
                id=max_id + 1, id_match=id_match, uuid=_new_uuid(),
                id_character_match=id_character, timestamp=now, id_event=None,
                clock=clock, log_message=message, ts_insert=now, ts_update=now,
            ))
            session.commit()
