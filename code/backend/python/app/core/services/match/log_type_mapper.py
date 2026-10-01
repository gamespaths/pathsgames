"""v0.41.4 — the log_events message to timeline type rule, shared by the match logs service and the
match export (so they never drift), plus the storage prefix an imported entry gets back. Mirrors Java."""
from typing import Optional

WEATHER, MOVEMENT, SLEEP, CLOCK_ADVANCE, RECOVERY = "WEATHER", "MOVEMENT", "SLEEP", "CLOCK_ADVANCE", "RECOVERY"
EVENT, CHOICE, COUNTER_ZERO, AUTOMATIC_EVENT = "EVENT", "CHOICE", "COUNTER_ZERO", "AUTOMATIC_EVENT"
RANDOM_EVENT, REGISTRY_CHANGE, MISSION_CHANGE = "RANDOM_EVENT", "REGISTRY_CHANGE", "MISSION_CHANGE"
ITEM_ADD, ITEM_USE, ITEM_DROP, EXP_USE = "ITEM_ADD", "ITEM_USE", "ITEM_DROP", "EXP_USE"
PASS, EDGE_STATE, TRAIT_CHANGE = "PASS", "EDGE_STATE", "TRAIT_CHANGE"
MATCH_LIFECYCLE, ADMIN_ACTION, OTHER = "MATCH_LIFECYCLE", "ADMIN_ACTION", "OTHER"

MSG_SLEEP = "ACTION_SLEEP"
MSG_PASS = "ACTION_PASS"
MSG_EVENT_EXECUTED = "EVENT_EXECUTED"
MSG_CHOICE_SELECTED = "CHOICE_SELECTED"
MSG_TRAIT_ADD = "TRAIT_ADD"
MSG_TRAIT_REMOVE = "TRAIT_REMOVE"
PREFIX_TRAIT = "TRAIT_"
PREFIX_MATCH = "MATCH_"
PREFIX_ADMIN = "ADMIN_"
# An imported entry that must not count as an engine marker.
MSG_UNCOUNTED = "IMPORTED_UNCOUNTED"

# Edge-state rows are matched on their first word: COMA_RECOVERED and ALL_PLAYER_COMA contain COMA.
EDGE_STATES = frozenset(("COMA", "SADNESS_OVERFLOW", "COMA_RECOVERED", "ALL_PLAYER_COMA"))

# The log_events types in classification order, with the message prefix that selects them.
_PREFIXED = (
    (MSG_EVENT_EXECUTED, EVENT), (MSG_CHOICE_SELECTED, CHOICE), ("counter", COUNTER_ZERO),
    ("automatic event", AUTOMATIC_EVENT), ("random event", RANDOM_EVENT),
    ("REGISTRY_CHANGE", REGISTRY_CHANGE), ("MISSION_CHANGE", MISSION_CHANGE), ("EXP_USE", EXP_USE),
    ("recovery", RECOVERY),
)

# The storage prefix an imported entry of a log_events type gets back.
_STORAGE_PREFIX = {
    SLEEP: MSG_SLEEP, PASS: MSG_PASS, EVENT: MSG_EVENT_EXECUTED, CHOICE: MSG_CHOICE_SELECTED,
    COUNTER_ZERO: "counter", AUTOMATIC_EVENT: "automatic event", RANDOM_EVENT: "random event",
    REGISTRY_CHANGE: "REGISTRY_CHANGE", MISSION_CHANGE: "MISSION_CHANGE", EXP_USE: "EXP_USE",
    RECOVERY: "recovery", TRAIT_CHANGE: PREFIX_TRAIT, MATCH_LIFECYCLE: PREFIX_MATCH,
    ADMIN_ACTION: PREFIX_ADMIN, EDGE_STATE: "",
}

_ITEM_TYPES = {"ADD": ITEM_ADD, "USE": ITEM_USE, "DROP": ITEM_DROP, "REMOVE": ITEM_DROP}


def event_type(msg: Optional[str]) -> Optional[str]:
    """The timeline type of a log_events message: OTHER when no rule matches, None for a None message."""
    if msg is None:
        return None
    if msg == MSG_SLEEP:
        return SLEEP
    for prefix, type_ in _PREFIXED:
        if msg.startswith(prefix):
            return type_
    first_word = msg.split(" ", 1)[0]
    if msg == MSG_PASS:
        return PASS
    if first_word in EDGE_STATES:
        return EDGE_STATE
    if msg.startswith(MSG_TRAIT_ADD + " ") or msg.startswith(MSG_TRAIT_REMOVE + " "):
        return TRAIT_CHANGE
    if msg.startswith(PREFIX_MATCH):
        return MATCH_LIFECYCLE
    if msg.startswith(PREFIX_ADMIN):
        return ADMIN_ACTION
    return OTHER


def timeline_message(type_: Optional[str], msg: Optional[str]) -> Optional[str]:
    """What the timeline shows as the message of a log_events row of that type."""
    if msg is None or type_ is None:
        return None
    if type_ in (SLEEP, PASS):
        return None
    if type_ == EDGE_STATE:
        return msg.split(" ", 1)[0]
    if type_ == TRAIT_CHANGE:
        return msg[len(PREFIX_TRAIT):]
    if type_ == MATCH_LIFECYCLE:
        return msg[len(PREFIX_MATCH):]
    if type_ == ADMIN_ACTION:
        return msg[len(PREFIX_ADMIN):]
    return msg


def is_event_row(type_: Optional[str]) -> bool:
    """True for the types stored as log_events rows (the others have a table of their own)."""
    return type_ is not None and (type_ in _STORAGE_PREFIX or type_ == OTHER)


def stored_message(type_: Optional[str], message: Optional[str]) -> str:
    """The log_message an imported entry is stored with: the type prefix plus the message (H.2.3 rule)."""
    prefix = _STORAGE_PREFIX.get(type_) if type_ is not None else None
    if prefix is None:
        if message is None:
            return MSG_UNCOUNTED
        marker = message.startswith(MSG_EVENT_EXECUTED) or message.startswith(MSG_CHOICE_SELECTED)
        return f"{MSG_UNCOUNTED} {message}" if marker else message
    if message is None or not message.strip():
        return prefix or MSG_UNCOUNTED
    if not prefix or message.startswith(prefix):
        return message
    return prefix + message if prefix.endswith("_") else f"{prefix} {message}"


def item_type(action: Optional[str]) -> Optional[str]:
    """log_item_usage.action to timeline type: REMOVE and DROP share one; unknown actions answer None."""
    if action is None:
        return ITEM_USE
    return _ITEM_TYPES.get(str(action).strip().upper())
