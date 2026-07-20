"""Step 26 — time-start recovery, class bonuses & location counters.

Mirrors the Java ``TimeStartRecoveryService``. On every time-start the engine
recovers each character's stats based on their location safety, applies the
class bonuses, clamps to the caps, and decrements location time counters
(seeding missing rows for occupied counter-locations). When a counter reaches
zero the location's ``id_event_if_counter_zero`` is logged as pending; the
actual event execution is wired in Step 29.

Recovery rules (P = location.secure_param + difficulty.energy; safe when
secure_param > 0):
  * safe   -> energy += DEX + P, life += COS + secure_param, sadness -= INT + secure_param
  * unsafe -> energy += difficulty.energy only (no DEX, no secure_param)
"""
from typing import Any, Dict, List

from app.core.models.match.time_models import RecoveryItem
from app.core.ports.match.edge_state_ports import EdgeStateStorePort
from app.core.ports.match.time_ports import TimeStorePort
from app.core.services.match import edge_state_evaluator


class TimeStartRecoveryService:
    def __init__(self, store: TimeStorePort, edge_store: EdgeStateStorePort = None) -> None:
        self.store = store
        self.edge_store = edge_store

    def apply_at_time_start(self, id_match: int) -> List[RecoveryItem]:
        ctx = self.store.load_recovery_context(id_match)
        if ctx is None:
            return []
        characters = self.store.find_recovery_characters(id_match) or []
        if not characters:
            return []

        id_story = ctx["id_story"]
        difficulty_energy = _nz(ctx.get("difficulty_energy"))
        current_clock = _nz(ctx.get("current_clock"))

        safety_by_location: Dict[int, Dict[str, Any]] = {
            s["id_location"]: s for s in self.store.find_location_safety(id_story)
        }
        all_bonuses = self.store.find_class_bonuses(id_story) or []
        state_rows = self.store.find_state_locations(id_match)
        counter_by_location: Dict[int, int] = {
            s["id_location"]: _nz(s.get("clock_counter")) for s in state_rows
        }
        flag_by_location: Dict[int, int] = {
            s["id_location"]: _nz(s.get("flag_already_actived")) for s in state_rows
        }

        # Build the set of locations occupied by characters.
        occupied = {c["id_location"] for c in characters if c.get("id_location") is not None}

        # 1a. Re-seed occupied locations whose existing counter is 0, not yet activated,
        #     but the story definition now carries counter_time > 0. Fixes matches
        #     created before counter_time was added to the location.
        for id_location in occupied:
            existing = counter_by_location.get(id_location)
            if existing is None or existing > 0:
                continue
            if flag_by_location.get(id_location, 0) != 0:
                continue
            s = safety_by_location.get(id_location)
            counter_time = _nz(s.get("counter_time")) if s else 0
            if counter_time <= 0:
                continue
            self.store.update_state_location_counter(id_match, id_location, counter_time)
            counter_by_location[id_location] = counter_time

        # 1b. Seed missing state-location rows for occupied counter-locations.
        for id_location in occupied:
            if id_location in counter_by_location:
                continue
            s = safety_by_location.get(id_location)
            counter_time = _nz(s.get("counter_time")) if s else 0
            if counter_time > 0:
                self.store.insert_state_location(id_match, id_location, counter_time)
                counter_by_location[id_location] = counter_time

        # 2. Recover each character.
        recaps: List[RecoveryItem] = []
        coma_after: List[bool] = []
        for c in characters:
            s = safety_by_location.get(c.get("id_location"))
            secure_param = _nz(s.get("secure_param")) if s else 0
            safe = secure_param > 0
            p = secure_param + difficulty_energy
            bonuses = [b for b in all_bonuses if b.get("id_class") == c.get("id_class")]
            energy, life, sad, sad_unclamped = compute_recovery(
                _nz(c.get("dexterity")), _nz(c.get("intelligence")), _nz(c.get("constitution")),
                _nz(c.get("energy")), _nz(c.get("life")), _nz(c.get("sad")),
                _nz(c.get("energy_max")), _nz(c.get("life_max")), _nz(c.get("sad_max")),
                safe, p, difficulty_energy,
                _sum_bonus(bonuses, "energy"), _sum_bonus(bonuses, "life"), _sum_bonus(bonuses, "sad"),
            )
            # A recovery can still push a character over an edge: a positive class sad bonus
            # raises sadness, and an unsafe location never heals. Evaluate before the write so
            # the corrected values land in the same UPDATE.
            v = edge_state_evaluator.evaluate(edge_state_evaluator.CharacterState(
                c["id"], life, sad_unclamped, _nz(c.get("sad_max")),
                _nz(c.get("constitution")), bool(c.get("is_coma"))))

            energy_delta = energy - _nz(c.get("energy"))
            life_delta = v.life_after - _nz(c.get("life"))
            sad_delta = v.sad_after - _nz(c.get("sad"))
            self.store.update_character_stats(id_match, c["id"], energy, v.life_after,
                                              v.sad_after)
            self.store.log_recovery(
                id_match, c["id"],
                f"recovery safe={safe} p={p} dEnergy={energy_delta} dLife={life_delta} dSad={sad_delta}",
            )
            edge_state_evaluator.persist(self.edge_store, id_match, v, current_clock, None)
            recaps.append(RecoveryItem(c["uuid"], energy_delta, life_delta, sad_delta))
            coma_after.append(v.coma_triggered or bool(c.get("is_coma")))

        if edge_state_evaluator.all_in_coma(coma_after):
            edge_state_evaluator.log_all_player_coma(self.edge_store, id_match, None,
                                                     current_clock)

        # 3. Decrement counters; flag zeros (event execution deferred to Step 29).
        for id_location, current in counter_by_location.items():
            current = _nz(current)
            if current <= 0:
                continue
            nxt = current - 1
            self.store.update_state_location_counter(id_match, id_location, nxt)
            if nxt == 0:
                s = safety_by_location.get(id_location)
                pending = s.get("id_event_if_counter_zero") if s else None
                msg = f"counter reached zero at location {id_location}"
                if pending is not None:
                    msg += f"; pending event {pending}"
                self.store.log_counter_zero(id_match, id_location, pending, msg)
                self.store.mark_state_location_activated(id_match, id_location)

        return recaps


def compute_recovery(dexterity: int, intelligence: int, constitution: int,
                     energy: int, life: int, sad: int,
                     energy_max: int, life_max: int, sad_max: int,
                     safe: bool, p: int, difficulty_energy: int,
                     bonus_energy: int, bonus_life: int, bonus_sad: int):
    """Pure recovery math: safe/unsafe formula + class bonuses + clamping."""
    secure_param = p - difficulty_energy
    new_energy = energy + dexterity + p if safe else energy + difficulty_energy
    new_life = life
    new_sad = sad
    if safe:
        new_life = life + constitution + secure_param
        new_sad = sad - (intelligence + secure_param)
    new_energy += bonus_energy
    new_life += bonus_life
    new_sad += bonus_sad
    return (
        _clamp(new_energy, 0, energy_max),
        _clamp(new_life, 0, life_max),
        _clamp(new_sad, 0, sad_max),
        new_sad,
    )


def _clamp(value: int, low: int, high: int) -> int:
    if high < low:
        return low
    return max(low, min(high, value))


def _sum_bonus(bonuses: List[Dict[str, Any]], stat: str) -> int:
    return sum(_nz(b.get("value")) for b in bonuses
               if str(b.get("statistic", "")).lower() == stat)


def _nz(value) -> int:
    return int(value) if value is not None else 0
