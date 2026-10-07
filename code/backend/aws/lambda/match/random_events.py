"""Step 39 — picks at most one global random event per time-start (mirrors the Java reference).
``probability`` is an absolute percentage; a total above 100 scales every row down.
"""
import random

from match import registry as _registry
from match.events import _nz

# Keeps the random roll of day N away from the weather roll of day N+1 (seed + clock).
SEED_SALT = 1_000_003
PERCENT = 100
TYPE_ONCE = "ONCE"


def is_runnable(row, events_by_id, owning_choices, consumed):
    """Positive probability, existing event without choices, and not a spent ONCE event."""
    id_event = _nz(row.get('idEvent'))
    if probability(row) <= 0 or id_event <= 0:
        return False
    event = events_by_id.get(id_event)
    if event is None or id_event in owning_choices:
        return False
    once = str(event.get('type') or '').upper() == TYPE_ONCE
    return not (once and id_event in (consumed or set()))


def condition_matches(row, registry):
    key = row.get('conditionKey')
    if _registry.no_condition(key):
        return True
    return _registry.evaluate(row.get('registryValueOperatorCondition'),
                              row.get('conditionValue'), _registry.values_in(registry, key))


def eligible(story, registry, owning_choices, consumed):
    """The rows that may fire today: runnable and with their condition met."""
    events_by_id = {_nz(e.get('id')): e for e in (story.get('events') or [])}
    return [r for r in (story.get('globalRandomEvents') or [])
            if is_runnable(r, events_by_id, owning_choices, consumed)
            and condition_matches(r, registry)]


def order(rows):
    """Probability DESC, then id ASC: the fixed order of the cumulative walk."""
    return sorted(rows, key=lambda r: (-probability(r), _nz(r.get('id'))))


def walk(ordered, roll):
    """The row whose cumulative range holds ``roll``; None when roll lands past the total."""
    cumulative = 0
    for r in ordered:
        cumulative += probability(r)
        if roll < cumulative:
            return r
    return None


def pick(rows, seed):
    """Roll in [0, max(100, total)): below 100 the gap is "nothing", above it the rows scale."""
    if not rows:
        return None
    # Coerce to int: DynamoDB Decimal seeds are not accepted by random.Random().
    # Safe: seed is provided externally (deterministic, not for security).
    roll = random.Random(int(seed)).randrange(max(PERCENT, total(rows)))  # NOSONAR
    return walk(order(rows), roll)


def total(rows):
    return sum(probability(r) for r in rows)


def seed_for(match, story):
    base = match.get('rngSeed')
    seed = _nz(base) if base is not None else _nz(story.get('id'))
    return seed + _nz(match.get('currentClock')) + SEED_SALT


def probability(row):
    return int(_nz(row.get('probability')))
