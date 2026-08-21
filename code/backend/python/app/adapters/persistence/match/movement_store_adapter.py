"""Step 28 — SQLAlchemy adapter implementing :class:`MovementStorePort`.

Subclasses :class:`TurnCycleStoreAdapter` to reuse ``find_user_id_by_uuid`` and
adds the movement reads/writes over gaming_character_instance / list_locations /
list_locations_neighbors / gaming_state_registry / log_movements. The Python
location schema has no ``cost_energy_enter`` column, so the location entry cost
is treated as 0; ``is_safe`` plays the role of ``secure_param`` (safe when > 0),
mirroring the Step 26 recovery adapter.
"""
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func

from app.adapters.persistence.match.models import (
    GamingCharacterInstanceEntity,
    GamingInventoryItemsEntity,
    GamingMatchEntity,
    GamingStateRegistryEntity,
    LogMovementEntity,
)
from app.adapters.persistence.match.turn_cycle_store_adapter import (
    TurnCycleStoreAdapter,
    _new_uuid,
    _now_iso,
)
from app.adapters.persistence.story.models import (
    ItemEntity,
    LocationEntity,
    LocationNeighborEntity,
    WeatherRuleEntity,
)
from app.core.ports.match.movement_ports import MovementStorePort


class MovementStoreAdapter(TurnCycleStoreAdapter, MovementStorePort):

    def find_match_for_movement(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(
                GamingMatchEntity.uuid == match_uuid).first()
            if m is None:
                return None
            return {
                "id": m.id,
                "uuid": m.uuid,
                "status": m.status,
                "current_clock": m.current_clock or 0,
                "id_story": m.id_story,
                "id_user_creator": m.id_user_creator,
            }

    def find_character_by_match_and_user(self, id_match: int,
                                         id_user: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            c = (session.query(GamingCharacterInstanceEntity)
                 .filter(GamingCharacterInstanceEntity.id_match == id_match,
                         GamingCharacterInstanceEntity.id_user == id_user)
                 .first())
            if c is None:
                return None
            return self._character_dict(c, self._carried_weight_by_character(id_match).get(c.id, 0))

    def find_characters_for_movement(self, id_match: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (session.query(GamingCharacterInstanceEntity)
                    .filter(GamingCharacterInstanceEntity.id_match == id_match).all())
            return [{"id": c.id, "id_location": c.id_location} for c in rows]

    def find_location_by_uuid(self, id_story: int, uuid: str) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            l = (session.query(LocationEntity)
                 .filter(LocationEntity.id_story == id_story, LocationEntity.uuid == uuid)
                 .first())
            return self._location_dict(l) if l is not None else None

    def find_location_by_id(self, id_story: int, id_location: int) -> Optional[Dict[str, Any]]:
        with self.session_factory() as session:
            l = (session.query(LocationEntity)
                 .filter(LocationEntity.id_story == id_story, LocationEntity.id == id_location)
                 .first())
            return self._location_dict(l) if l is not None else None

    def find_neighbors_of_location(self, id_story: int,
                                   id_location: int) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            rows = (session.query(LocationNeighborEntity)
                    .filter(LocationNeighborEntity.id_story == id_story)
                    .all())
            out = []
            for n in rows:
                if n.id_location_from == id_location or n.id_location_to == id_location:
                    out.append({
                        "id_from": n.id_location_from,
                        "id_to": n.id_location_to,
                        "direction": n.direction,
                        "energy_cost": n.energy_cost or 0,
                        "condition_key": n.condition_key,
                        "condition_value": n.condition_value,
                        "flag_back": n.flag_back or 0,
                    })
            return out

    def find_registry_value(self, id_match: int, key: str) -> Optional[str]:
        with self.session_factory() as session:
            for r in (session.query(GamingStateRegistryEntity)
                      .filter(GamingStateRegistryEntity.id_match == id_match).all()):
                if r.key == key:
                    if r.string_value is not None:
                        return r.string_value
                    if r.int_value is not None:
                        return str(r.int_value)
                    return None
            return None

    def find_current_weather_move_cost(self, id_match: int) -> Tuple[int, int]:
        with self.session_factory() as session:
            m = session.query(GamingMatchEntity).filter(GamingMatchEntity.id == id_match).first()
            if m is None or m.id_current_weather is None or m.id_story is None:
                return (0, 0)
            w = (session.query(WeatherRuleEntity)
                 .filter(WeatherRuleEntity.id_story == m.id_story,
                         WeatherRuleEntity.id == m.id_current_weather)
                 .first())
            if w is None:
                return (0, 0)
            return (w.cost_move_safe_location or 0, w.cost_move_not_safe_location or 0)

    def count_characters_at_location(self, id_match: int, id_location: int) -> int:
        with self.session_factory() as session:
            return (session.query(func.count(GamingCharacterInstanceEntity.id))
                    .filter(GamingCharacterInstanceEntity.id_match == id_match,
                            GamingCharacterInstanceEntity.id_location == id_location)
                    .scalar() or 0)

    def update_character_location_and_energy(self, id_match: int, id_character: int,
                                             id_location: int, energy: int) -> None:
        with self.session_factory() as session:
            c = (session.query(GamingCharacterInstanceEntity)
                 .filter(GamingCharacterInstanceEntity.id_match == id_match,
                         GamingCharacterInstanceEntity.id == id_character)
                 .first())
            if c is None:
                return
            c.id_location = id_location
            c.energy = energy
            c.ts_update = _now_iso()
            session.commit()

    def insert_movement_log(self, id_match: int, id_character: int,
                            from_location: Optional[int], to_location: int,
                            energy_cost: int) -> None:
        with self.session_factory() as session:
            max_id = session.query(func.max(LogMovementEntity.id)).scalar() or 0
            now = _now_iso()
            session.add(LogMovementEntity(
                id=max_id + 1,
                id_match=id_match,
                uuid=_new_uuid(),
                id_character_match=id_character,
                id_location_from=from_location,
                id_location_to=to_location,
                energy_cost=energy_cost,
                timestamp_start=now,
                ts_insert=now,
                ts_update=now,
            ))
            session.commit()

    def find_visited_location_ids(self, id_match: int) -> List[int]:
        ids: List[int] = []
        seen = set()

        def add(value):
            if value is not None and value not in seen:
                seen.add(value)
                ids.append(value)

        with self.session_factory() as session:
            for c in (session.query(GamingCharacterInstanceEntity)
                      .filter(GamingCharacterInstanceEntity.id_match == id_match).all()):
                add(c.id_location)
            for l in (session.query(LogMovementEntity)
                      .filter(LogMovementEntity.id_match == id_match).all()):
                add(l.id_location_from)
                add(l.id_location_to)
        return ids

    # ── mappers ───────────────────────────────────────────────────────────────

    def _carried_weight_by_character(self, id_match: int) -> Dict[int, int]:
        """Step 35 — carried weight per character, in a constant number of queries.

        The formula is the one the match /info endpoint reports: Sigma (weight x amount),
        an unknown item weighing 0, a null weight 0 and a null amount 1. The two MUST
        agree, or /info would show a weight the movement gate does not act on.
        """
        with self.session_factory() as session:
            m = (session.query(GamingMatchEntity)
                 .filter(GamingMatchEntity.id == id_match).first())
            if m is None or m.id_story is None:
                return {}
            unit_weight = {
                i.id: (i.weight or 0)
                for i in session.query(ItemEntity).filter(ItemEntity.id_story == m.id_story).all()
            }
            out: Dict[int, int] = {}
            rows = (session.query(GamingInventoryItemsEntity)
                    .filter(GamingInventoryItemsEntity.id_match == id_match).all())
            for r in rows:
                w = unit_weight.get(r.id_item, 0) if r.id_item is not None else 0
                a = r.amount if r.amount is not None else 1
                out[r.id_character_match] = out.get(r.id_character_match, 0) + w * a
            return out

    @staticmethod
    def _character_dict(c: GamingCharacterInstanceEntity,
                        carried_weight: int = 0) -> Dict[str, Any]:
        return {
            "id": c.id,
            "uuid": c.uuid,
            "id_location": c.id_location,
            "energy": c.energy or 0,
            "energy_max": c.energy_max or 0,
            # Step 35 — the real Sigma (item.weight x amount).
            "carried_weight": carried_weight,
            "weight_max": c.weight_max or 0,
            "is_sleeping": bool(c.is_sleeping),
            "is_coma": bool(c.is_coma),
        }

    @staticmethod
    def _location_dict(l: LocationEntity) -> Dict[str, Any]:
        return {
            "id": l.id,
            "uuid": l.uuid,
            "id_card": l.id_card,
            # Python schema: is_safe doubles as secure_param; no cost_energy_enter column.
            "secure_param": l.is_safe or 0,
            "cost_energy_enter": 0,
            "max_characters": l.max_characters,
        }
