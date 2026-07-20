"""Step 30 — THE edge-state rules (sadness overflow, coma). Mirrors ``EdgeStateEvaluator.java``.

Two rules, in a deliberate order, because the first can cause the second:

1. **Sadness overflow.** ``sad >= sad_max`` costs the character COS (its constitution) life
   points, resets sadness to zero and forces sleep.
2. **Coma.** ``life <= 0`` raises ``is_coma`` and ``is_sleeping`` and stamps
   ``clock_in_coma``.

The cascade is the whole point of evaluating them together: the life the coma rule reads is
the life *after* the overflow subtraction, so one event can push a character over the
sadness cap and into a coma in a single pass.

Like :mod:`event_availability` this takes a snapshot rather than a store port, so the
services that mutate stats — event execution and the Step 26 time-start recovery — share one
implementation of the rules instead of two.

Rescue, the GAMEOVER transition and the multiplayer help endpoints are NOT here: they belong
to step 59 of the roadmap.
"""
from dataclasses import dataclass
from typing import Iterable, Optional

from app.core.ports.match.edge_state_ports import (
    MSG_ALL_PLAYER_COMA, MSG_COMA, MSG_SADNESS_OVERFLOW, EdgeStateStorePort,
)


def _clamp(value: int, low: int, high: int) -> int:
    """Mirrors ``TimeStartRecoveryService.clamp``: returns ``low`` when ``high < low``."""
    if high < low:
        return low
    return max(low, min(high, value))


@dataclass(frozen=True)
class CharacterState:
    """Everything the two rules need, and nothing else.

    ``sad_unclamped`` is the raw sum before the ``[0, sad_max]`` clamp. For a well-authored
    character it agrees with the clamped value, since clamping a number at or above the cap
    yields the cap; it is carried separately so the rule reads what the effect actually did
    rather than what storage could represent.
    """

    id_character: int
    life: int
    sad_unclamped: int
    sad_max: int
    constitution: int
    already_coma: bool


@dataclass(frozen=True)
class Verdict:
    """What the caller must apply. Nothing is mutated here."""

    id_character: int
    sadness_overflow: bool
    coma_triggered: bool
    forced_sleep: bool
    life_after: int
    sad_after: int

    def anything(self) -> bool:
        """True when this verdict changes anything at all."""
        return self.sadness_overflow or self.coma_triggered


def evaluate(s: CharacterState) -> Verdict:
    """The single verdict for one character.

    ``already_coma`` suppresses only the coma *trigger* — the log row and the
    ``clock_in_coma`` stamp — never the arithmetic: a comatose character caught by a
    ``target=ALL`` sadness effect still takes the life hit.
    """
    life = s.life
    # A non-positive cap makes every comparison below true and would drain COS life on every
    # single event. sad_max comes from story import and nothing forces it positive, so an
    # unauthored cap must disable the rule rather than fire it forever.
    overflow = s.sad_max > 0 and s.sad_unclamped >= s.sad_max
    sad = _clamp(s.sad_unclamped, 0, s.sad_max)
    forced_sleep = False

    if overflow:
        life = max(0, life - s.constitution)
        sad = 0
        forced_sleep = True

    coma_triggered = life <= 0 and not s.already_coma
    if coma_triggered:
        forced_sleep = True

    return Verdict(s.id_character, overflow, coma_triggered, forced_sleep, life, sad)


def all_in_coma(coma_flags: Optional[Iterable[bool]]) -> bool:
    """True when every character of the match is comatose.

    An empty roster is NOT all-in-coma — the guard lives here so no call site can forget it.
    """
    if not coma_flags:
        return False
    flags = list(coma_flags)
    if not flags:
        return False
    return all(bool(f) for f in flags)


def persist(store: EdgeStateStorePort, id_match: int, v: Verdict, clock: int,
            id_event: Optional[int]) -> None:
    """Persist one verdict: the state flags plus the ``log_events`` rows.

    Stat values are NOT written here. Each service already owns a stats write of its own and
    knows when to issue it; duplicating it would mean two UPDATEs per character.
    """
    if v.sadness_overflow:
        store.log_edge_state(id_match, v.id_character, id_event, clock,
                             f"{MSG_SADNESS_OVERFLOW} {v.id_character}")
    if v.coma_triggered:
        store.set_coma(id_match, v.id_character, clock)
        store.log_edge_state(id_match, v.id_character, id_event, clock,
                             f"{MSG_COMA} {v.id_character}")
    elif v.forced_sleep:
        # Coma already implies sleep, so this is the overflow-without-coma case only.
        store.set_sleeping(id_match, v.id_character)


def log_all_player_coma(store: EdgeStateStorePort, id_match: int, id_character: Optional[int],
                        clock: int) -> None:
    """The party-wide audit row, written by whichever service detected the collapse."""
    store.log_edge_state(id_match, id_character, None, clock,
                         f"{MSG_ALL_PLAYER_COMA} {id_match}")
