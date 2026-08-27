"""Step 25 — SQLAlchemy adapter implementing :class:`TimeStorePort`.

Subclasses :class:`TurnCycleStoreAdapter` to reuse all the Step 24 read/write
methods (match, characters, queue) and adds the time-advancement writes.
"""
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import func

from typing import List

from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    GamingStateLocationEntity,
    LogClockHistoryEntity,
    LogEventsEntity,
)
from app.adapters.persistence.match.turn_cycle_store_adapter import (
    TurnCycleStoreAdapter,
    _new_uuid,
    _now_iso,
)
from app.adapters.persistence.story.models import (
    ClassBonusEntity,
    LocationEntity,
    StoryDifficultyEntity,
    StoryEntity,
    TextEntity,
)
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

    def set_all_characters_sleeping(self, id_match: int) -> None:
        """Step 29 — the bulk counterpart of wake_all_characters, for an event with
        flag_end_time: everyone is put to sleep, then time advances."""
        with self.session_factory() as session:
            rows = (
                session.query(GamingCharacterInstanceEntity)
                .filter(GamingCharacterInstanceEntity.id_match == id_match)
                .all()
            )
            now = _now_iso()
            for c in rows:
                c.is_sleeping = 1
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

    # ── Step 26: time-start recovery ────────────────────────────────────────

    def load_recovery_context(self, id_match: int):
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(GamingMatchEntity.id == id_match).first()
            if m is None or m.id_story is None:
                return None
            difficulty_energy = 0
            if m.id_difficulty is not None:
                d = (
                    session.query(StoryDifficultyEntity)
                    .filter(
                        StoryDifficultyEntity.id_story == m.id_story,
                        StoryDifficultyEntity.id == m.id_difficulty,
                    )
                    .first()
                )
                if d is not None and d.energy is not None:
                    difficulty_energy = d.energy
            return {"id_story": m.id_story, "difficulty_energy": difficulty_energy,
                    "current_clock": m.current_clock or 0}

    def find_recovery_characters(self, id_match: int) -> List[dict]:
        with self.session_factory() as session:
            rows = (
                session.query(GamingCharacterInstanceEntity)
                .filter(GamingCharacterInstanceEntity.id_match == id_match)
                .all()
            )
            return [{
                "id": c.id, "uuid": c.uuid, "id_class": c.id_class, "id_location": c.id_location,
                "dexterity": c.dexterity, "intelligence": c.intelligence,
                "constitution": c.constitution, "energy": c.energy, "life": c.life, "sad": c.sad,
                "energy_max": c.energy_max, "life_max": c.life_max, "sad_max": c.sad_max,
                # Step 30: without this every time-start would re-stamp clock_in_coma.
                "is_coma": bool(c.is_coma),
            } for c in rows]

    def find_location_safety(self, id_story: int) -> List[dict]:
        with self.session_factory() as session:
            rows = (
                session.query(LocationEntity)
                .filter(LocationEntity.id_story == id_story)
                .all()
            )
            # Python schema uses is_safe (0/1) + counter_time; treat is_safe as the
            # numeric secure_param (safe when > 0) to mirror the Java formula.
            return [{
                "id_location": l.id,
                "secure_param": l.is_safe or 0,
                "counter_time": l.counter_time,
                "id_event_if_counter_zero": l.id_event_if_counter_zero,
                # Step 33 — the other time-start trigger, and the ordering column.
                "id_event_if_character_start_time": l.id_event_if_character_start_time,
                "priority_automatic_event": l.priority_automatic_event,
            } for l in rows]

    def find_class_bonuses(self, id_story: int) -> List[dict]:
        with self.session_factory() as session:
            rows = (
                session.query(ClassBonusEntity)
                .filter(ClassBonusEntity.id_story == id_story)
                .all()
            )
            return [{"id_class": b.id_class, "statistic": b.statistic, "value": b.value}
                    for b in rows]

    def find_state_locations(self, id_match: int) -> List[dict]:
        with self.session_factory() as session:
            rows = (
                session.query(GamingStateLocationEntity)
                .filter(GamingStateLocationEntity.id_match == id_match)
                .all()
            )
            return [{
                "id_location": s.id_location,
                "clock_counter": s.clock_counter,
                "flag_already_actived": s.flag_already_actived or 0,
            } for s in rows]

    def update_character_stats(self, id_match: int, id_character: int,
                               energy: int, life: int, sad: int) -> None:
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
            c.energy = energy
            c.life = life
            c.sad = sad
            c.ts_update = _now_iso()
            session.commit()

    def insert_state_location(self, id_match: int, id_location: int, clock_counter: int) -> None:
        with self.session_factory() as session:
            now = _now_iso()
            session.add(GamingStateLocationEntity(
                id_match=id_match,
                id_location=id_location,
                uuid=_new_uuid(),
                flag_already_actived=0,
                clock_counter=clock_counter,
                ts_insert=now,
                ts_update=now,
            ))
            session.commit()

    def update_state_location_counter(self, id_match: int, id_location: int,
                                      new_clock_counter: int) -> None:
        with self.session_factory() as session:
            s = (
                session.query(GamingStateLocationEntity)
                .filter(
                    GamingStateLocationEntity.id_match == id_match,
                    GamingStateLocationEntity.id_location == id_location,
                )
                .first()
            )
            if s is None:
                return
            s.clock_counter = new_clock_counter
            s.ts_update = _now_iso()
            session.commit()

    def mark_state_location_activated(self, id_match: int, id_location: int) -> None:
        with self.session_factory() as session:
            s = (
                session.query(GamingStateLocationEntity)
                .filter(
                    GamingStateLocationEntity.id_match == id_match,
                    GamingStateLocationEntity.id_location == id_location,
                )
                .first()
            )
            if s is None:
                return
            s.flag_already_actived = 1
            s.ts_update = _now_iso()
            session.commit()

    def log_recovery(self, id_match: int, id_character: int, message: str) -> None:
        self._insert_log_event(id_match, id_character_match=id_character,
                               id_event=None, message=message)

    def log_counter_zero(self, id_match: int, id_location: int,
                         id_event_if_counter_zero, clock, message: str) -> None:
        # Step 33 — without the clock this row sorted outside the timeline, and the
        # location existed only inside the message string.
        self._insert_log_event(id_match, id_character_match=None,
                               id_event=id_event_if_counter_zero, message=message,
                               clock=clock, id_location=id_location)

    def log_sleep(self, id_match: int, id_character: int, clock: int) -> None:
        """Write ACTION_SLEEP to log_events with the current clock (Step 28.7)."""
        self._insert_log_event(id_match, id_character_match=id_character,
                               id_event=None, message="ACTION_SLEEP", clock=clock)

    def _insert_log_event(self, id_match: int, id_character_match, id_event,
                          message: str, clock: int = None, id_location=None) -> None:
        with self.session_factory() as session:
            max_id = session.query(func.max(LogEventsEntity.id)).scalar() or 0
            now = _now_iso()
            session.add(LogEventsEntity(
                id=max_id + 1,
                id_match=id_match,
                uuid=_new_uuid(),
                id_character_match=id_character_match,
                timestamp=now,
                id_event=id_event,
                clock=clock,
                id_location=id_location,
                log_message=message,
                ts_insert=now,
                ts_update=now,
            ))
            session.commit()
