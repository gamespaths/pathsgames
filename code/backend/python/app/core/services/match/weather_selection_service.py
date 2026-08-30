"""Step 27 — weather selection service (mirrors the Java reference).

At every time-start (match start and each clock advance) the engine selects one
active weather rule for the story with a deterministic **weighted roll** (weight =
``probability``), filtered by the current clock time range and an optional
registry condition. The chosen weather is stored on ``gaming_match``
(``id_current_weather``), logged in ``log_weather``, and its ``delta_energy`` is
applied to every character (clamped 0..energy_max). When the rule carries an
``id_event`` it is recorded as pending. When no rule is eligible the current
weather is cleared.

The roll uses ``random.Random(rng_seed + clock)`` so a match created with
rng_seed=42 is reproducible and the weather still varies clock-to-clock.
"""
import random
from typing import Any, Dict, List, Optional


class WeatherSelectionService:
    def __init__(self, store: "WeatherStorePort") -> None:
        self.store = store

    # ── selection ────────────────────────────────────────────────────────────

    def apply_at_time_start(self, id_match: int) -> Dict[str, Any]:
        """Select and apply the weather for a match at time-start. Returns a recap
        dict ``{"selected", "id_weather", "weather_uuid", "delta_energy",
        "character_deltas"}``."""
        ctx = self.store.load_context(id_match)
        if ctx is None:
            return self._none()
        clock = ctx.get("current_clock", 0) or 0

        eligible = self._filter_eligible(
            self.store.find_active_weather_rules(ctx["id_story"]) or [], id_match, clock)

        if not eligible:
            self.store.set_current_weather(id_match, None)
            return self._none()

        seed = (ctx.get("rng_seed") if ctx.get("rng_seed") is not None else ctx["id_story"]) + clock
        chosen = self._weighted_pick(eligible, seed)

        self.store.set_current_weather(id_match, chosen["id"])
        self.store.insert_log_weather(id_match, clock, chosen["id"])

        deltas: List[Dict[str, int]] = []
        delta = int(chosen.get("delta_energy") or 0)
        if delta != 0:
            for c in self.store.find_characters(id_match) or []:
                new_energy = self._clamp(c["energy"] + delta, 0, c["energy_max"])
                applied = new_energy - c["energy"]
                if applied != 0:
                    self.store.update_character_energy(id_match, c["id"], new_energy)
                deltas.append({"id_character": c["id"], "energy_applied": applied})

        if chosen.get("id_event") is not None:
            self.store.log_weather_event(
                id_match, chosen["id_event"],
                f"Weather {chosen.get('uuid')} triggered event {chosen['id_event']}")

        return {
            "selected": True,
            "id_weather": chosen["id"],
            "weather_uuid": chosen.get("uuid"),
            "delta_energy": delta,
            "character_deltas": deltas,
        }

    # ── queries (REST / admin) ────────────────────────────────────────────────

    def current_weather(self, match_uuid: str) -> Optional[Dict[str, Any]]:
        return self.store.find_current_weather_by_uuid(match_uuid)

    def weather_admin(self, match_uuid: str) -> Dict[str, Any]:
        return {
            "rng_seed": self.store.find_rng_seed(match_uuid),
            "current": self.store.find_current_weather_by_uuid(match_uuid),
            "rules": self.store.find_weather_rules_for_match(match_uuid),
            "log": self.store.find_weather_log(match_uuid),
        }

    # ── pure helpers ───────────────────────────────────────────────────────────

    def _filter_eligible(self, rules: List[Dict[str, Any]], id_match: int,
                         clock: int) -> List[Dict[str, Any]]:
        out = []
        for r in rules:
            if not self.time_matches(r, clock):
                continue
            if not self._condition_matches(r, id_match):
                continue
            out.append(r)
        return out

    @staticmethod
    def time_matches(rule: Dict[str, Any], clock: int) -> bool:
        time_from = rule.get("time_from")
        time_to = rule.get("time_to")
        if time_from is not None and clock < time_from:
            return False
        return time_to is None or clock <= time_to

    def _condition_matches(self, rule: Dict[str, Any], id_match: int) -> bool:
        key = rule.get("condition_key")
        if not key:
            return True
        actual = self.store.find_registry_value(id_match, key)
        expected = rule.get("condition_key_value")
        return actual is None if expected is None else expected == actual

    @staticmethod
    def _weighted_pick(eligible: List[Dict[str, Any]], seed: int) -> Dict[str, Any]:
        ordered = sorted(eligible, key=lambda r: r["id"])
        total = sum(max(0.0, float(r.get("probability") or 0)) for r in ordered)
        if total <= 0:
            return ordered[0]
        # Safe: seed is provided externally (deterministic, not for security).
        roll = random.Random(seed).random() * total
        cumulative = 0.0
        for r in ordered:
            cumulative += max(0.0, float(r.get("probability") or 0))
            if roll < cumulative:
                return r
        return ordered[-1]

    @staticmethod
    def _clamp(v: int, lo: int, hi: int) -> int:
        if v < lo:
            return lo
        if hi > 0 and v > hi:
            return hi
        return v

    @staticmethod
    def _none() -> Dict[str, Any]:
        return {"selected": False, "id_weather": None, "weather_uuid": None,
                "delta_energy": 0, "character_deltas": []}
