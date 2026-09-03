"""Step 29 — THE check procedure.

One pure function, no ports, no I/O — and therefore exactly one answer to "can this event
be executed?", shared by the two places that ask:

  * ``MatchQueryService``, for the ``available`` flag it puts on every event of
    ``GET /api/match/{uuid}/info``;
  * ``EventService``, to accept or reject ``execute-event``.

Because it takes a pre-loaded :class:`EventCheckContext` rather than a store port,
match-info evaluates N events against a single context: no query happens inside the loop.

All conditions combine in AND — there is no ``list_events_conditions`` table and none is
planned; the conditions are columns on ``list_events``.

The order below is the contract: the first failing check names the reason, and the cheapest
/ most explanatory reasons come first (a sleeping character is told they cannot act, not
that they lack energy).

Mirrors ``EventAvailabilityChecker.java``.
"""
from typing import Any, Dict, Optional

from app.core.models.match.event_models import EventAvailability, EventCheckContext, EventError
from app.core.services.match import registry_service

# Only these two types are player-executable; AUTOMATIC and FIRST are engine-driven, and
# authored stories also use END / END_GAME for the end-game event (identified by
# story.id_event_end_game, not by its type). Anything unknown is simply not executable.
EXECUTABLE_TYPES = {"NORMAL", "ONCE"}

# Executable at most once per MATCH — not per clock, not per location.
TYPE_ONCE = "ONCE"


def check(event: Optional[Dict[str, Any]], ctx: Optional[EventCheckContext]) -> EventAvailability:
    """The single verdict. ``ctx`` may be None (caller owns no character)."""
    if not event:
        return EventAvailability.no(EventError.EVENT_NOT_FOUND)
    if ctx is None or ctx.id_character is None:
        return EventAvailability.no(EventError.CHARACTER_CANNOT_ACT)
    # Coma outranks sleep: a comatose character is also flagged asleep, and the two are not
    # the same news for the player — one waits, the other needs a rescue.
    if ctx.coma:
        return EventAvailability.no(EventError.COMA)
    if ctx.sleeping:
        return EventAvailability.no(EventError.SLEEPING)

    event_type = (event.get("type") or "").strip().upper()
    if event_type not in EXECUTABLE_TYPES:
        return EventAvailability.no(EventError.EVENT_NOT_EXECUTABLE_TYPE)

    event_id = event.get("id")
    if event_type == TYPE_ONCE and event_id is not None and event_id in ctx.consumed_event_ids:
        return EventAvailability.no(EventError.ONCE_ALREADY_CONSUMED)

    # A null id_specific_location means the event has no location constraint at all.
    id_location = event.get("id_specific_location")
    if id_location is not None and id_location != ctx.id_location:
        return EventAvailability.no(EventError.WRONG_LOCATION)

    if ctx.energy < (event.get("cost_enery") or 0):
        return EventAvailability.no(EventError.NOT_ENOUGH_ENERGY)
    if ctx.coin < (event.get("cost_coin") or 0):
        return EventAvailability.no(EventError.NOT_ENOUGH_COINS)
    # v0.35.3 — the three costs are read in the order they were added to the contract; an
    # event asking for two resources at once names the first one it cannot pay.
    if ctx.food < (event.get("cost_food") or 0):
        return EventAvailability.no(EventError.NOT_ENOUGH_FOOD)
    if ctx.magic < (event.get("cost_magic") or 0):
        return EventAvailability.no(EventError.NOT_ENOUGH_MAGIC)

    if not _registry_met(event, ctx):
        return EventAvailability.no(EventError.REGISTRY_CONDITION_NOT_MET)

    # On list_events id_weather is a CONDITION; on list_events_effects it is an EFFECT.
    id_weather = event.get("id_weather")
    if id_weather is not None and id_weather != ctx.current_weather_id:
        return EventAvailability.no(EventError.WEATHER_CONDITION_NOT_MET)

    id_item = event.get("id_item_condition")
    if id_item is not None and id_item not in ctx.owned_item_ids:
        return EventAvailability.no(EventError.ITEM_CONDITION_NOT_MET)

    id_class = event.get("id_class_condition")
    if id_class is not None and id_class != ctx.id_class:
        return EventAvailability.no(EventError.CLASS_CONDITION_NOT_MET)

    return EventAvailability.ok()


def _registry_met(event: Dict[str, Any], ctx: EventCheckContext) -> bool:
    """Step 36 — the comparison is registry_service.evaluate, shared with choices, movement
    and weather, and the operator column widens it beyond equality."""
    key = event.get("registry_key_condition")
    if registry_service.no_condition(key):
        return True
    return registry_service.evaluate(event.get("registry_value_operator_condition"),
                                     event.get("registry_value_condition"),
                                     ctx.registry.get(key))
