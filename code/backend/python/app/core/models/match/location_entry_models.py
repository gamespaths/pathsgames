"""Step 33 — location entry events: the events nobody asks for.

Mirrors the Java ``LocationEntryPort`` records. Two things trigger them, and neither is
a player action: a character **arriving** somewhere (by walking there or by being pulled
there by an effect), and a location's clock **running out** — or a time unit beginning
where a character stands.

The event is named by the location, not found by a query over the events table:
``list_locations`` has carried ``id_event_if_first_time``, ``id_event_not_first_time``,
``id_event_if_character_enter_empty_location``, ``id_event_if_character_start_time`` and
``id_event_if_counter_zero`` since the first schema. A referenced event keeps
``type = 'AUTOMATIC'``, which the ``{NORMAL, ONCE}`` allowlist already refuses to players.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

#: First arrival of the party at this location.
TRIGGER_FIRST_ENTRY = "FIRST_ENTRY"
#: Any later arrival — the world has already been discovered here.
TRIGGER_SUBSEQUENT_ENTRY = "SUBSEQUENT_ENTRY"
#: The arriving character found nobody else here. Orthogonal to the two above.
TRIGGER_MOVE_INTO_EMPTY_LOCATION = "MOVE_INTO_EMPTY_LOCATION"
#: The location's counter reached zero. One-shot for the whole match.
TRIGGER_COUNTER_ZERO = "COUNTER_ZERO"
#: A time unit began with a character standing here.
TRIGGER_CHARACTER_START_TIME = "CHARACTER_START_TIME"

#: Message prefix of the audit row an automatic event writes to ``log_events``.
MSG_AUTOMATIC_EVENT = "automatic event"

#: How many arrivals one request may cascade through before the engine gives up.
#: An automatic event may move a character, and that move is itself an arrival, so
#: ``A -> move to B -> move back to A`` is a loop an author can write in two form fields.
#: Not creating it stays the author's responsibility; this turns a hung request into a
#: logged abort.
MAX_ENTRY_DEPTH = 8

VISIBILITY_FULL = "FULL"
VISIBILITY_NAMED = "NAMED"
VISIBILITY_ANONYMOUS = "ANONYMOUS"


@dataclass
class ArrivalContext:
    """Everything the entry resolution needs about an arrival."""
    id_match: int
    id_story: int
    id_character: int
    id_location: int
    current_clock: int
    lang: Optional[str] = None


@dataclass
class PendingAutomaticEvent:
    """One automatic event the time-start pass found waiting.

    ``id_actor_character`` is the nominal actor — the lowest-id character standing in that
    location — and is ``None`` when nobody is there, in which case the effects that need a
    recipient are skipped while registry, weather and the chain still run.
    """
    trigger: str
    id_location: int
    id_event: int
    id_actor_character: Optional[int] = None
    priority: int = 0


@dataclass
class AutomaticEventFired:
    """What one automatic event did, slim enough to ride on a movement or sleep response."""
    trigger: str
    id_location: int
    event_uuid: Optional[str]
    card: Optional[dict] = None
    effects: List[Any] = field(default_factory=list)
    stat_changes: List[Any] = field(default_factory=list)
    location_changes: List[Any] = field(default_factory=list)
    game_over: bool = False
    #: v0.35.6 — what the Step 30 rules did about it, epilogue included. An arrival kills
    #: exactly as an executed event does; before this the collapse reached the board only on
    #: the next reload, as a flag with no card and no story.
    edge_state: Any = None


@dataclass
class CounterZeroItem:
    """One automatic event a time-start fired, as told to **one** recipient.

    ``visibility`` is per player and decided in the delivery layer, never while the engine
    builds the list — every player has their own visited set. All three cards are
    **omitted** (``None`` / empty) when the visibility is ``ANONYMOUS``: a counter runs down
    even where nobody has ever set foot, and naming that place would hand the player the map.

    Three cards, because waking up to a piece of news has three sides: ``card`` is the
    **event's** card — what happened; ``card_effects`` are the ``AppliedEffect`` rows it
    applied, each with its own card, which is the narrative the board renders;
    ``card_location`` is the place. Until v0.33.1 only the place travelled.
    """
    trigger: str
    id_location: int
    card: Optional[dict]
    card_location: Optional[dict]
    card_effects: List[Any]
    event_uuid: Optional[str]
    clock: int
    visibility: str


def to_camel_automatic_event(f: AutomaticEventFired) -> Dict[str, Any]:
    """REST shape of one fired automatic event.

    The three lists hold the same dataclasses ``execute-event`` returns
    (``AppliedEffect`` / ``StatChange`` / ``LocationChange``), so they are mapped here
    rather than handed to the JSON encoder raw — a dataclass is not serializable and the
    whole response would 500.
    """
    return {
        "trigger": f.trigger,
        "idLocation": f.id_location,
        "eventUuid": f.event_uuid,
        "card": f.card,
        "effects": [_effect_to_camel(e) for e in (f.effects or [])],
        "statChanges": [_stat_to_camel(c) for c in (f.stat_changes or [])],
        "locationChanges": [_location_to_camel(c) for c in (f.location_changes or [])],
        "gameOver": bool(f.game_over),
    }


def to_camel_edge_state(e) -> Dict[str, Any]:
    """v0.35.6 — REST shape of a Step 30 verdict, for the responses that are not
    execute-event: a movement and a sleep answer the very same object."""
    if e is None:
        return None
    return {
        "sadnessOverflowUuids": list(e.sadness_overflow_uuids),
        "comaUuids": list(e.coma_uuids),
        "allPlayersInComa": e.all_players_in_coma,
        "comaEventUuid": e.coma_event_uuid,
        "comaEventCard": e.coma_event_card,
        "comaExecutedEventUuids": list(e.coma_executed_event_uuids),
        "comaEffects": [_effect_to_camel(x) for x in (e.coma_effects or [])],
    }


def _effect_to_camel(e) -> Dict[str, Any]:
    """Mirrors ``event_controller._effect_to_camel``; duplicated rather than imported
    because a core model must not depend on the REST adapter."""
    return {
        "eventUuid": e.event_uuid,
        "effectUuid": e.effect_uuid,
        "statistic": e.statistic,
        "value": e.value,
        "target": e.target,
        "targetClass": e.target_class,
        "characterUuids": e.character_uuids,
        # The effect's OWN card is the narrative to render — not the event's.
        "card": e.card,
    }


def _stat_to_camel(c) -> Dict[str, Any]:
    return {"characterUuid": c.character_uuid, "statistic": c.statistic,
            "before": c.before, "after": c.after, "delta": c.delta}


def _location_to_camel(c) -> Dict[str, Any]:
    return {"characterUuid": c.character_uuid,
            "fromLocationUuid": c.from_location_uuid,
            "toLocationUuid": c.to_location_uuid}


def to_camel_counter_zero(i: CounterZeroItem) -> Dict[str, Any]:
    """REST shape of one counter-zero notice.

    ``cardEffects`` holds the same ``AppliedEffect`` dataclasses ``execute-event`` returns, so
    they go through ``_effect_to_camel`` here rather than to the JSON encoder raw — a
    dataclass is not serializable and the whole response would 500.
    """
    return {
        "trigger": i.trigger,
        "idLocation": i.id_location,
        "card": i.card,
        # The location card still comes from the Python card reader, which takes no lang and
        # emits snake_case with unresolved id_text_* — the frontend ignores it for now.
        "cardLocation": i.card_location,
        "cardEffects": [_effect_to_camel(e) for e in (i.card_effects or [])],
        "eventUuid": i.event_uuid,
        "clock": i.clock,
        "visibility": i.visibility,
    }
