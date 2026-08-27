"""Step 26 — time-start recovery, class bonuses & location counters.

Mirrors the Java ``TimeStartRecoveryService``. On every time-start the engine
recovers each character's stats based on their location safety, applies the
class bonuses, clamps to the caps, and decrements location time counters
(seeding missing rows for occupied counter-locations).

Step 33: when a counter reaches zero the location's ``id_event_if_counter_zero`` is
handed **up** rather than merely logged, together with the
``id_event_if_character_start_time`` of every occupied location. This service collects
those events; it does not run them. The event engine sits *above* it in the wiring (an
event can force a time end, which comes back here), so executing them from inside would
close a dependency cycle — ``TimeAdvancementService`` runs the list once this returns.

Recovery rules (P = location.secure_param + difficulty.energy; safe when
secure_param > 0):
  * safe   -> energy += DEX + P, life += COS + secure_param, sadness -= INT + secure_param
  * unsafe -> energy += difficulty.energy only (no DEX, no secure_param)
"""
from typing import Any, Dict, List

from app.core.models.match import location_entry_models as lem
from app.core.models.match.location_entry_models import PendingAutomaticEvent
from app.core.models.match.time_models import RecoveryItem, TimeStartOutcome
from app.core.ports.match.edge_state_ports import EdgeStateStorePort
from app.core.ports.match.time_ports import TimeStorePort
from app.core.services.match import edge_state_evaluator


class TimeStartRecoveryService:
    def __init__(self, store: TimeStorePort, edge_store: EdgeStateStorePort = None) -> None:
        self.store = store
        self.edge_store = edge_store

    def apply_at_time_start(self, id_match: int) -> TimeStartOutcome:
        ctx = self.store.load_recovery_context(id_match)
        if ctx is None:
            return TimeStartOutcome([], [])
        characters = self.store.find_recovery_characters(id_match) or []
        if not characters:
            return TimeStartOutcome([], [])

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

            # v0.30.1 — a comatose character who rested in a safe location wakes. Safe recovery
            # has already lifted life above zero (life += COS + secure_param, both >= 1), so the
            # guard cannot leave it awake-but-dead to re-coma next clock. Independent of the
            # others: one character waking does not require the rest of the location to wake.
            still_coma = v.coma_triggered or bool(c.get("is_coma"))
            if bool(c.get("is_coma")) and safe and v.life_after > 0:
                self.edge_store.clear_coma(id_match, c["id"])
                self.edge_store.log_edge_state(
                    id_match, c["id"], None, current_clock,
                    f"{edge_state_evaluator.MSG_COMA_RECOVERED} {c['id']}")
                still_coma = False
            coma_after.append(still_coma)

        if edge_state_evaluator.all_in_coma(coma_after):
            edge_state_evaluator.log_all_player_coma(self.edge_store, id_match, None,
                                                     current_clock)

        # 3. Decrement counters; flag zeros and collect the events they owe.
        #    A counter is a ONE-SHOT FUSE: `current <= 0` skips an exhausted one and
        #    mark_state_location_activated latches it, so the event fires exactly once per
        #    match and the counter never restarts.
        pending_events: List[PendingAutomaticEvent] = []
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
                self.store.log_counter_zero(id_match, id_location, pending,
                                            current_clock, msg)
                self.store.mark_state_location_activated(id_match, id_location)
                _add_pending(pending_events, lem.TRIGGER_COUNTER_ZERO, id_location,
                             pending, _nominal_actor(characters, id_location), s)

        # 4. Step 33 — a time unit BEGINNING where a character stands is its own trigger,
        #    independent of any counter. One entry per occupied location, not per
        #    character: the event describes the place, and the nominal actor is who it
        #    happens to.
        for id_location in occupied:
            s = safety_by_location.get(id_location)
            if not s:
                continue
            _add_pending(pending_events, lem.TRIGGER_CHARACTER_START_TIME, id_location,
                         s.get("id_event_if_character_start_time"),
                         _nominal_actor(characters, id_location), s)

        # Deterministic across locations: priority_automatic_event first, then location id.
        pending_events.sort(key=lambda p: (p.priority, p.id_location))

        return TimeStartOutcome(recaps, pending_events)


def _add_pending(out: List[PendingAutomaticEvent], trigger: str, id_location: int,
                 id_event, id_actor_character, safety) -> None:
    """Skips a null or non-positive event id — an unauthored trigger is not a trigger."""
    if not id_event or id_event <= 0:
        return
    priority = _nz(safety.get("priority_automatic_event")) if safety else 0
    out.append(PendingAutomaticEvent(trigger, id_location, int(id_event),
                                     id_actor_character, priority))


def _nominal_actor(characters: List[Dict[str, Any]], id_location: int):
    """The lowest-id character standing in a location, or None when nobody is.

    An automatic location event belongs to the place, not to a player, but its effects
    still have to resolve ``target = ONLY_ONE`` against somebody and ``target = ALL``
    against everyone *there*. Picking the lowest id makes that choice deterministic;
    picking nobody, when the place is empty, is equally correct — the world still changes,
    it just changes around no one.
    """
    ids = [c["id"] for c in characters
           if c.get("id_location") == id_location and c.get("id") is not None]
    return min(ids) if ids else None


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
