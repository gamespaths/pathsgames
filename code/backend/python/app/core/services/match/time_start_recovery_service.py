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
from app.core.ports.match.time_ports import TimeStorePort


class TimeStartRecoveryService:
    def __init__(self, store: TimeStorePort) -> None:
        self.store = store

    def apply_at_time_start(self, id_match: int) -> List[RecoveryItem]:
        ctx = self.store.load_recovery_context(id_match)
        if ctx is None:
            return []
        characters = self.store.find_recovery_characters(id_match) or []
        if not characters:
            return []

        id_story = ctx["id_story"]
        difficulty_energy = _nz(ctx.get("difficulty_energy"))

        safety_by_location: Dict[int, Dict[str, Any]] = {
            s["id_location"]: s for s in self.store.find_location_safety(id_story)
        }
        all_bonuses = self.store.find_class_bonuses(id_story) or []
        counter_by_location: Dict[int, int] = {
            s["id_location"]: _nz(s.get("clock_counter"))
            for s in self.store.find_state_locations(id_match)
        }

        # 1. Seed missing state-location rows for occupied counter-locations.
        occupied = {c["id_location"] for c in characters if c.get("id_location") is not None}
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
        for c in characters:
            s = safety_by_location.get(c.get("id_location"))
            secure_param = _nz(s.get("secure_param")) if s else 0
            safe = secure_param > 0
            p = secure_param + difficulty_energy
            bonuses = [b for b in all_bonuses if b.get("id_class") == c.get("id_class")]
            energy, life, sad = compute_recovery(
                _nz(c.get("dexterity")), _nz(c.get("intelligence")), _nz(c.get("constitution")),
                _nz(c.get("energy")), _nz(c.get("life")), _nz(c.get("sad")),
                _nz(c.get("energy_max")), _nz(c.get("life_max")), _nz(c.get("sad_max")),
                safe, p, difficulty_energy,
                _sum_bonus(bonuses, "energy"), _sum_bonus(bonuses, "life"), _sum_bonus(bonuses, "sad"),
            )
            energy_delta = energy - _nz(c.get("energy"))
            life_delta = life - _nz(c.get("life"))
            sad_delta = sad - _nz(c.get("sad"))
            self.store.update_character_stats(id_match, c["id"], energy, life, sad)
            self.store.log_recovery(
                id_match, c["id"],
                f"recovery safe={safe} p={p} dEnergy={energy_delta} dLife={life_delta} dSad={sad_delta}",
            )
            recaps.append(RecoveryItem(c["uuid"], energy_delta, life_delta, sad_delta))

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
