"""Step 33 — SQLAlchemy adapter implementing :class:`LocationEntryStorePort`."""
from typing import Any, Dict, List, Optional

from sqlalchemy import func

from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingStateLocationEntity,
    LogEventsEntity,
    LogMovementEntity,
)
from app.adapters.persistence.story.models import LocationEntity
from app.adapters.persistence.match.turn_cycle_store_adapter import _new_uuid, _now_iso
from app.core.ports.match.location_entry_ports import LocationEntryStorePort


class LocationEntryStoreAdapter(LocationEntryStorePort):

    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    def find_location_triggers(self, id_story: int,
                               id_location: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            l = (
                session.query(LocationEntity)
                .filter(LocationEntity.id_story == id_story,
                        LocationEntity.id == id_location)
                .first()
            )
            if l is None:
                return None
            return {
                "id_location": l.id,
                "id_card": l.id_card,
                "id_event_if_first_time": l.id_event_if_first_time,
                "id_event_not_first_time": l.id_event_not_first_time,
                "id_event_if_character_enter_empty_location": l.id_event_if_character_enter_empty_location,
                "id_event_if_character_start_time": l.id_event_if_character_start_time,
                "id_event_if_counter_zero": l.id_event_if_counter_zero,
                "priority_automatic_event": l.priority_automatic_event,
                "key_to_add": l.key_to_add,
                "key_value_to_add": l.key_value_to_add,
                "key_to_add_not_first": l.key_to_add_not_first,
                "key_value_to_add_not_first": l.key_value_to_add_not_first,
            }

    def find_flag_visited(self, id_match: int, id_location: int) -> int:
        with self.session_factory() as session:
            s = self._state_row(session, id_match, id_location)
            return (s.flag_visited or 0) if s is not None else 0

    def mark_state_location_visited(self, id_match: int, id_location: int) -> None:
        with self.session_factory() as session:
            s = self._state_row(session, id_match, id_location)
            if s is None or (s.flag_visited or 0) == 1:
                return
            s.flag_visited = 1
            s.ts_update = _now_iso()
            session.commit()

    def count_other_characters_at_location(self, id_match: int, id_location: int,
                                           except_id_character: int) -> int:
        with self.session_factory() as session:
            return (
                session.query(func.count(GamingCharacterInstanceEntity.id))
                .filter(GamingCharacterInstanceEntity.id_match == id_match,
                        GamingCharacterInstanceEntity.id_location == id_location,
                        GamingCharacterInstanceEntity.id != except_id_character)
                .scalar()
            ) or 0

    def find_nominal_actor_at_location(self, id_match: int,
                                       id_location: int) -> Optional[int]:
        with self.session_factory() as session:
            return (
                session.query(func.min(GamingCharacterInstanceEntity.id))
                .filter(GamingCharacterInstanceEntity.id_match == id_match,
                        GamingCharacterInstanceEntity.id_location == id_location)
                .scalar()
            )

    def log_automatic_event(self, id_match: int, id_character: Optional[int],
                            id_location: int, id_event: Optional[int],
                            clock: Optional[int], message: str) -> None:
        with self.session_factory() as session:
            max_id = session.query(func.max(LogEventsEntity.id)).scalar() or 0
            now = _now_iso()
            session.add(LogEventsEntity(
                id=max_id + 1,
                id_match=id_match,
                uuid=_new_uuid(),
                id_character_match=id_character,
                timestamp=now,
                id_event=id_event,
                id_location=id_location,
                clock=clock,
                log_message=message,
                ts_insert=now,
                ts_update=now,
            ))
            session.commit()

    def find_visited_location_ids(self, id_match: int) -> List[int]:
        with self.session_factory() as session:
            ids: List[int] = []
            for c in (session.query(GamingCharacterInstanceEntity)
                      .filter(GamingCharacterInstanceEntity.id_match == id_match).all()):
                if c.id_location is not None and c.id_location not in ids:
                    ids.append(c.id_location)
            for m in (session.query(LogMovementEntity)
                      .filter(LogMovementEntity.id_match == id_match).all()):
                for loc in (m.id_location_from, m.id_location_to):
                    if loc is not None and loc not in ids:
                        ids.append(loc)
            return ids

    def find_character_location(self, id_match: int,
                                id_character: int) -> Optional[int]:
        with self.session_factory() as session:
            c = (
                session.query(GamingCharacterInstanceEntity)
                .filter(GamingCharacterInstanceEntity.id_match == id_match,
                        GamingCharacterInstanceEntity.id == id_character)
                .first()
            )
            return c.id_location if c is not None else None

    @staticmethod
    def _state_row(session, id_match: int, id_location: int):
        return (
            session.query(GamingStateLocationEntity)
            .filter(GamingStateLocationEntity.id_match == id_match,
                    GamingStateLocationEntity.id_location == id_location)
            .first()
        )
