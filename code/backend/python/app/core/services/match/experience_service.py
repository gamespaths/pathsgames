"""Step 38 — the use-exp action.

Gates in the order the other gameplay services use, prices the point with
``ExperienceCost`` and writes + logs. Mirrors the Java ``ExperienceService``.
"""
from typing import Any, Dict

from app.core.ports.match.experience_ports import (
    ExperienceError,
    ExperiencePort,
    ExperienceStorePort,
)
from app.core.ports.match.match_ports import UserAccessPort
from app.core.services.match.experience_cost import STAT_FIELD, STATS, ExperienceCost

# Prefix of the log_events row the timeline classifies as EXP_USE.
MSG_EXP_USE = "EXP_USE"
_RUNNING = "RUNNING"


def normalize_stat(stat) -> str | None:
    """``dex``/``int``/``cos`` (trimmed, case-folded) or None."""
    token = stat.strip().lower() if isinstance(stat, str) else ""
    return token if token in STATS else None


class ExperienceService(ExperiencePort):
    def __init__(self, store: ExperienceStorePort, user_access_port: UserAccessPort) -> None:
        self.store = store
        self.user_access_port = user_access_port

    def use_exp(self, match_uuid: str, user_uuid: str, stat: str) -> Dict[str, Any]:
        user = self.user_access_port.find_by_uuid(user_uuid) if user_uuid else None
        if user is None:
            raise _not_found()
        match = self.store.find_match_by_uuid(match_uuid)
        if match is None:
            raise _not_found()
        actor = self.store.find_character_by_match_and_user(match["id"], user["id"])
        if actor is None:
            raise _not_found()

        if match.get("status") != _RUNNING:
            raise ExperienceError(ExperienceError.MATCH_NOT_RUNNING, "The match is not running")
        turn = match.get("id_character_current_turn")
        if turn is not None and turn != actor["id"]:
            raise ExperienceError(ExperienceError.NOT_YOUR_TURN, "It is not your character's turn")
        if actor.get("is_coma"):
            raise ExperienceError(ExperienceError.COMA, "The character is in a coma")
        if actor.get("is_sleeping"):
            raise ExperienceError(ExperienceError.SLEEPING, "The character is sleeping")
        token = normalize_stat(stat)
        if token is None:
            raise ExperienceError(ExperienceError.INVALID_STAT, "stat must be one of dex, int, cos")
        secure = None
        if actor.get("id_location") is not None and match.get("id_story") is not None:
            secure = self.store.find_location_secure_param(match["id_story"], actor["id_location"])
        if (secure or 0) <= 0:
            raise ExperienceError(ExperienceError.LOCATION_NOT_SAFE,
                                  "Experience can only be spent in a safe location")

        pricing = self._pricing_of(match)
        field = STAT_FIELD[token]
        before = int(actor.get(field) or 0)
        if pricing.at_cap(before):
            raise ExperienceError(ExperienceError.MAX_STAT_VALUE, f"The {token} is already at its maximum")
        cost = pricing.cost(before)
        exp_before = int(actor.get("exp") or 0)
        if exp_before < cost:
            raise ExperienceError(ExperienceError.NOT_ENOUGH_EXP,
                                  f"Not enough experience: {cost} needed, {exp_before} available")

        after = before + 1
        exp_after = exp_before - cost
        stats = {f: int(actor.get(f) or 0) for f in STAT_FIELD.values()}
        stats[field] = after
        self.store.update_character(match["id"], actor["id"], stats["dexterity"],
                                    stats["intelligence"], stats["constitution"], exp_after)
        self.store.log_exp_use(match["id"], actor["id"], int(match.get("current_clock") or 0),
                               f"{MSG_EXP_USE} {token} {before}->{after} cost {cost}")
        return {
            "match_uuid": match.get("uuid"),
            "character_uuid": actor.get("uuid"),
            "stat": token,
            "stat_before": before,
            "stat_after": after,
            "exp_before": exp_before,
            "exp_after": exp_after,
            "exp_cost": cost,
            "exp_costs": pricing.costs(stats["dexterity"], stats["intelligence"], stats["constitution"]),
            "stat_changes": [
                {"character_uuid": actor.get("uuid"), "statistic": token,
                 "before": before, "after": after, "delta": 1},
                {"character_uuid": actor.get("uuid"), "statistic": "exp",
                 "before": exp_before, "after": exp_after, "delta": -cost},
            ],
        }

    def _pricing_of(self, match: Dict[str, Any]) -> ExperienceCost:
        if match.get("id_story") is None or match.get("id_difficulty") is None:
            return ExperienceCost(match.get("exp_cost"), 0, 0)
        return ExperienceCost.of(self.store.find_difficulty(match["id_story"], match["id_difficulty"]),
                                 match.get("exp_cost"))


def _not_found() -> ExperienceError:
    return ExperienceError(ExperienceError.MATCH_NOT_FOUND, "Match not found or not accessible")
