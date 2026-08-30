"""Step 27 — SQLAlchemy adapter backing :class:`WeatherSelectionService`.

Provides the read-then-write store methods the weather engine needs: load the
match context, read the active weather rules and registry values, apply the
energy delta, store the current weather, append ``log_weather`` rows and audit
weather-linked events.
"""
from typing import Any, Dict, List, Optional

from sqlalchemy import func

from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingMatchEntity,
    GamingStateRegistryEntity,
    LogEventsEntity,
    LogWeatherEntity,
)
from app.adapters.persistence.match.turn_cycle_store_adapter import _new_uuid, _now_iso
from app.adapters.persistence.story.models import CardEntity, TextEntity, WeatherRuleEntity


class WeatherStoreAdapter:
    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory

    def load_context(self, id_match: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            m = session.get(GamingMatchEntity, id_match)
            if m is None or m.id_story is None:
                return None
            return {"id_story": m.id_story, "current_clock": m.current_clock or 0,
                    "rng_seed": m.rng_seed}

    def find_active_weather_rules(self, id_story: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (session.query(WeatherRuleEntity)
                    .filter(WeatherRuleEntity.id_story == id_story).all())
            out = []
            for w in rows:
                if not w.active:
                    continue
                out.append(self._rule_to_dict(w))
            return out

    def find_registry_value(self, id_match: int, key: str) -> Optional[str]:
        with self.session_factory() as session:
            r = (session.query(GamingStateRegistryEntity)
                 .filter(GamingStateRegistryEntity.id_match == id_match,
                         GamingStateRegistryEntity.key == key).first())
            if r is None:
                return None
            if r.string_value is not None:
                return r.string_value
            if r.int_value is not None:
                return str(r.int_value)
            return None

    def find_characters(self, id_match: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (session.query(GamingCharacterInstanceEntity)
                    .filter(GamingCharacterInstanceEntity.id_match == id_match).all())
            return [{"id": c.id, "energy": c.energy or 0, "energy_max": c.energy_max or 0}
                    for c in rows]

    def update_character_energy(self, id_match: int, id_character: int, energy: int) -> None:
        with self.session_factory() as session:
            c = (session.query(GamingCharacterInstanceEntity)
                 .filter(GamingCharacterInstanceEntity.id_match == id_match,
                         GamingCharacterInstanceEntity.id == id_character).first())
            if c is not None:
                c.energy = energy
                c.ts_update = _now_iso()
                session.commit()

    def set_current_weather(self, id_match: int, id_weather: Optional[int]) -> None:
        with self.session_factory() as session:
            m = session.get(GamingMatchEntity, id_match)
            if m is not None:
                m.id_current_weather = id_weather
                m.ts_update = _now_iso()
                session.commit()

    def insert_log_weather(self, id_match: int, clock: int, id_weather: Optional[int]) -> None:
        with self.session_factory() as session:
            now = _now_iso()
            next_id = (session.query(func.coalesce(func.max(LogWeatherEntity.id), 0)).scalar() or 0) + 1
            session.add(LogWeatherEntity(
                id=next_id, id_match=id_match, uuid=_new_uuid(), clock=clock,
                id_weather=id_weather, timestamp_start=now, ts_insert=now, ts_update=now))
            session.commit()

    def log_weather_event(self, id_match: int, id_event: Optional[int], message: str) -> None:
        with self.session_factory() as session:
            now = _now_iso()
            next_id = (session.query(func.coalesce(func.max(LogEventsEntity.id), 0)).scalar() or 0) + 1
            session.add(LogEventsEntity(
                id=next_id, id_match=id_match, uuid=_new_uuid(), id_event=id_event,
                log_message=message, ts_insert=now, ts_update=now))
            session.commit()

    # ── queries ────────────────────────────────────────────────────────────────

    def find_current_weather_by_uuid(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            m = (session.query(GamingMatchEntity)
                 .filter(GamingMatchEntity.uuid == match_uuid).first())
            if m is None or m.id_current_weather is None or m.id_story is None:
                return None
            w = (session.query(WeatherRuleEntity)
                 .filter(WeatherRuleEntity.id_story == m.id_story,
                         WeatherRuleEntity.id == m.id_current_weather).first())
            if w is None:
                return None
            return {"id_weather": w.id, "uuid": w.uuid, "id_story": m.id_story,
                    "id_card": w.id_card, "id_text_name": w.id_text_name,
                    "delta_energy": w.delta_energy,
                    "cost_move_safe_location": w.cost_move_safe_location,
                    "cost_move_not_safe_location": w.cost_move_not_safe_location,
                    "current_clock": m.current_clock or 0}

    def find_weather_rules_for_match(self, match_uuid: str) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            m = (session.query(GamingMatchEntity)
                 .filter(GamingMatchEntity.uuid == match_uuid).first())
            if m is None or m.id_story is None:
                return []
            current = m.id_current_weather
            rows = (session.query(WeatherRuleEntity)
                    .filter(WeatherRuleEntity.id_story == m.id_story).all())
            return [{
                "id": w.id, "uuid": w.uuid, "id_text_name": w.id_text_name,
                "name": self._resolve_weather_name(session, m.id_story, w.id_text_name, w.id_card),
                "probability": w.probability, "delta_energy": w.delta_energy,
                "cost_move_safe_location": w.cost_move_safe_location,
                "cost_move_not_safe_location": w.cost_move_not_safe_location,
                "active": bool(w.active), "current": current is not None and current == w.id,
            } for w in rows]

    def _resolve_weather_name(self, session, id_story, id_text_name, id_card):
        """The id_text_name text, falling back to the title text of the weather card."""
        name = self._resolve_text(session, id_story, id_text_name)
        if name is not None:
            return name
        if id_card is not None:
            card = (session.query(CardEntity)
                    .filter(CardEntity.id_story == id_story, CardEntity.id == id_card).first())
            if card is not None:
                return self._resolve_text(session, id_story, card.id_text_title)
        return None

    @staticmethod
    def _resolve_text(session, id_story, id_text):
        if id_text is None:
            return None
        t = (session.query(TextEntity)
             .filter(TextEntity.id_story == id_story, TextEntity.id_text == id_text,
                     TextEntity.lang == "en").first())
        return t.short_text if t is not None else None

    def find_rng_seed(self, match_uuid: str) -> Optional[int]:
        with self.session_factory() as session:
            m = (session.query(GamingMatchEntity)
                 .filter(GamingMatchEntity.uuid == match_uuid).first())
            return None if m is None else m.rng_seed

    def find_weather_log(self, match_uuid: str) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            m = (session.query(GamingMatchEntity)
                 .filter(GamingMatchEntity.uuid == match_uuid).first())
            if m is None:
                return []
            rules = {}
            if m.id_story is not None:
                for w in (session.query(WeatherRuleEntity)
                          .filter(WeatherRuleEntity.id_story == m.id_story).all()):
                    rules[w.id] = w
            rows = (session.query(LogWeatherEntity)
                    .filter(LogWeatherEntity.id_match == m.id)
                    .order_by(LogWeatherEntity.clock.asc()).all())
            out = []
            for l in rows:
                w = rules.get(l.id_weather)
                out.append({
                    "id": l.id, "uuid": l.uuid, "clock": l.clock, "id_weather": l.id_weather,
                    "weather_uuid": w.uuid if w else None,
                    "id_text_name": w.id_text_name if w else None,
                    "timestamp_start": l.timestamp_start,
                })
            return out

    @staticmethod
    def _rule_to_dict(w: WeatherRuleEntity) -> Dict[str, Any]:
        return {
            "id": w.id, "uuid": w.uuid, "probability": w.probability,
            "time_from": w.time_from, "time_to": w.time_to,
            "condition_key": w.condition_key, "condition_key_value": w.condition_key_value,
            "delta_energy": w.delta_energy, "id_event": w.id_event,
            "id_text_name": w.id_text_name,
        }
