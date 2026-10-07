"""Step 39 — SQLAlchemy adapter backing :class:`RandomEventSelectionService` (read only).
Running the picked event goes through ``EventService.run_random_event``.
"""
from typing import Any, Dict, List, Optional, Set

from app.adapters.persistence.match.event_store_adapter import EventStoreAdapter
from app.adapters.persistence.match.models import GamingMatchEntity
from app.adapters.persistence.story.models import (
    ChoiceEntity,
    EventEntity,
    GlobalRandomEventEntity,
)


class RandomEventStoreAdapter:
    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    def load_context(self, id_match: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            m = session.get(GamingMatchEntity, id_match)
            if m is None:
                return None
            return {"id_story": m.id_story, "current_clock": m.current_clock or 0,
                    "rng_seed": m.rng_seed, "status": m.status}

    def find_random_events(self, id_story: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (session.query(GlobalRandomEventEntity)
                    .filter(GlobalRandomEventEntity.id_story == id_story).all())
            if not rows:
                return []
            types = {e.id: e.type for e in session.query(EventEntity)
                     .filter(EventEntity.id_story == id_story).all()}
            with_choices = {c.id_event for c in session.query(ChoiceEntity)
                            .filter(ChoiceEntity.id_story == id_story).all()
                            if c.id_event is not None}
            out = []
            for r in rows:
                exists = r.id_event is not None and r.id_event in types
                out.append({
                    "id": r.id, "id_event": r.id_event,
                    "probability": int(r.probability or 0),
                    "condition_key": r.condition_key, "condition_value": r.condition_value,
                    "registry_value_operator_condition": r.registry_value_operator_condition,
                    "event_exists": exists,
                    "event_type": types.get(r.id_event) if exists else None,
                    "event_owns_choices": exists and r.id_event in with_choices,
                })
            return out

    def find_consumed_event_ids(self, id_match: int) -> Set[int]:
        with self.session_factory() as session:
            return EventStoreAdapter._consumed_event_ids(session, id_match)
