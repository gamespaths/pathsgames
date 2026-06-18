"""Step 25 — SQLAlchemy adapter implementing :class:`TimeStorePort`.

Subclasses :class:`TurnCycleStoreAdapter` to reuse all the Step 24 read/write
methods (match, characters, queue) and adds the time-advancement writes.
"""
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import func

from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    LogClockHistoryEntity,
)
from app.adapters.persistence.match.turn_cycle_store_adapter import (
    TurnCycleStoreAdapter,
    _new_uuid,
    _now_iso,
)
from app.adapters.persistence.story.models import StoryEntity, TextEntity
from app.core.ports.match.time_ports import TimeStorePort


class TimeStoreAdapter(TurnCycleStoreAdapter, TimeStorePort):

    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            c = (
                session.query(GamingCharacterInstanceEntity)
                .filter(
                    GamingCharacterInstanceEntity.id_match == id_match,
                    GamingCharacterInstanceEntity.id_user == id_user,
                )
                .first()
            )
            if c is None:
                return None
            return {
                "id": c.id,
                "uuid": c.uuid,
                "id_user": c.id_user,
                "dexterity": c.dexterity,
                "intelligence": c.intelligence,
                "constitution": c.constitution,
                "life": c.life,
                "energy": c.energy,
                "is_sleeping": bool(c.is_sleeping),
            }

    def set_character_sleeping(self, id_match: int, id_character: int, sleeping: bool) -> None:
        with self.session_factory() as session:
            c = (
                session.query(GamingCharacterInstanceEntity)
                .filter(
                    GamingCharacterInstanceEntity.id_match == id_match,
                    GamingCharacterInstanceEntity.id == id_character,
                )
                .first()
            )
            if c is None:
                return
            c.is_sleeping = 1 if sleeping else 0
            c.ts_update = _now_iso()
            session.commit()

    def wake_all_characters(self, id_match: int) -> None:
        with self.session_factory() as session:
            rows = (
                session.query(GamingCharacterInstanceEntity)
                .filter(GamingCharacterInstanceEntity.id_match == id_match)
                .all()
            )
            now = _now_iso()
            for c in rows:
                if c.is_sleeping:
                    c.is_sleeping = 0
                    c.ts_update = now
            session.commit()

    def increment_match_clock(self, id_match: int) -> int:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(GamingMatchEntity.id == id_match).first()
            if m is None:
                return 0
            new_clock = (m.current_clock or 0) + 1
            m.current_clock = new_clock
            m.ts_update = _now_iso()
            session.commit()
            return new_clock

    def insert_clock_history(self, id_match: int, clock: int) -> None:
        with self.session_factory() as session:
            max_id = session.query(func.max(LogClockHistoryEntity.id)).scalar() or 0
            now = _now_iso()
            session.add(LogClockHistoryEntity(
                id=max_id + 1,
                id_match=id_match,
                uuid=_new_uuid(),
                clock=clock,
                timestamp_start=now,
                ts_insert=now,
                ts_update=now,
            ))
            session.commit()

    def find_story_clock_labels(self, id_match: int,
                                lang: str) -> Tuple[Optional[str], Optional[str]]:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(GamingMatchEntity.id == id_match).first()
            if m is None or m.id_story is None:
                return (None, None)
            story = session.query(StoryEntity).filter(StoryEntity.id == m.id_story).first()
            if story is None:
                return (None, None)
            singular = self._resolve_text(session, m.id_story, story.id_text_clock_singular, lang)
            plural = self._resolve_text(session, m.id_story, story.id_text_clock_plural, lang)
            return (singular, plural)

    @staticmethod
    def _resolve_text(session, id_story: int, id_text: Optional[int],
                      lang: Optional[str]) -> Optional[str]:
        if id_text is None:
            return None
        effective = lang or "en"
        text = (
            session.query(TextEntity)
            .filter(
                TextEntity.id_story == id_story,
                TextEntity.id_text == id_text,
                TextEntity.lang == effective,
            )
            .first()
        )
        if text is None and effective != "en":
            text = (
                session.query(TextEntity)
                .filter(
                    TextEntity.id_story == id_story,
                    TextEntity.id_text == id_text,
                    TextEntity.lang == "en",
                )
                .first()
            )
        return text.short_text if text else None
