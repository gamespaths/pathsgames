"""Step 36 — the one place that reads, writes and compares the match registry.

Mirrors the Java ``RegistryService`` and the Python ``registry_service``: ``render`` and
``parse`` are inverses, and ``evaluate`` is the single comparison behind every registry
condition — events, edges, weather rules and choice options.

Storage note: on this backend the registry is a list embedded on the MATCH item, not a table,
so the "store" is that list and every write is part of the item the caller already holds.
"""

import uuid as _uuid

OP_EQ = "="
OP_NE = "!="
OP_GT = ">"
OP_LT = "<"

#: Prefix of the log row every write leaves behind; read by the match-logs builder.
MSG_REGISTRY_CHANGE = "REGISTRY_CHANGE"

#: A key hidden from the player: anything its definition does not mark PUBLIC.
VISIBILITY_PUBLIC = "PUBLIC"


# ── the two value primitives, exact inverses of each other ──────────────────

def render(string_value, int_value):
    """A row as one comparable string: the string wins, else the int, else None."""
    if string_value is not None:
        return string_value
    return None if int_value is None else str(int_value)


def render_row(row):
    if not row:
        return None
    return render(row.get('stringValue'), row.get('intValue'))


def parse(value):
    """A value as the pair of columns: numeric to intValue, anything else to stringValue,
    never both. Trimmed in both branches, so what an author types is what a condition reads."""
    if value is None:
        return {'stringValue': None, 'intValue': None}
    text = str(value).strip()
    try:
        return {'stringValue': None, 'intValue': int(text)}
    except ValueError:
        return {'stringValue': text, 'intValue': None}


def _numeric(value):
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


# ── comparison ──────────────────────────────────────────────────────────────

def _norm(value):
    """v0.36.2 — the form a value is COMPARED in: trimmed and case-folded, never stored."""
    return None if value is None else str(value).strip().lower()


def _eq(a, b):
    """Equality as every registry comparison means it: blind to case and to padding."""
    return _norm(a) == _norm(b)


def _first_matching(rows, value):
    """The row a value names, whatever case the author wrote it in. None when none does."""
    return next((r for r in rows if _eq(render_row(r), value)), None)


def no_condition(key):
    """True when the condition is absent altogether — a blank key means "no condition"."""
    return key is None or not str(key).strip()


def evaluate(operator, expected, actual):
    """The one registry comparison, over the SET of values a key holds.

    Step 36.1 generalised it; on a one-element set every reading below is the equality or
    comparison it always was, which is why no authored story had to change.

    * ``=``  — ∃: at least one member equals the value
    * ``!=`` — ∄: no member equals it (so an absent key satisfies it, as before)
    * ``>`` ``<`` — ∀: EVERY member compares that way, and an empty set never does.
      Vacuous truth would open a door, and the doctrine is that a typo closes one.

    A None expected value, an unparseable operand or an unknown operator is NOT met.
    """
    if expected is None:
        return False
    values = list(actual or [])
    op = OP_EQ if operator is None or not str(operator).strip() else str(operator).strip()
    if op == OP_EQ:
        return any(_eq(v, expected) for v in values)
    if op == OP_NE:
        return not any(_eq(v, expected) for v in values)
    if op in (OP_GT, OP_LT):
        # ∀ over an empty set is vacuously true in logic and wrong here.
        if not values:
            return False
        e = _numeric(expected)
        numbers = [_numeric(v) for v in values]
        if e is None or any(n is None for n in numbers):
            return False
        return all(n > e for n in numbers) if op == OP_GT else all(n < e for n in numbers)
    return False


def ordered(values):
    """Members ordered for display: numbers numerically first, then the rest alphabetically.
    Computed here so both payloads and all three backends agree."""
    out = list(values or [])
    out.sort(key=lambda v: (0, _numeric(v), '') if _numeric(v) is not None else (1, 0, v or ''))
    return out


def is_multi(definition):
    """The story's own declaration, which decides how a write behaves for a key with no row."""
    return bool(definition) and bool(definition.get('multiValue'))


# ── reads ───────────────────────────────────────────────────────────────────

def find_rows(match, key):
    """Every row of one key: one for a single key, N for a multi-valued one, none when the
    key is absent or its set is empty."""
    return rows_in((match or {}).get('registry'), key)


def rows_in(registry, key):
    """The same, off a bare registry list — the shape most of the handler holds."""
    return [row for row in (registry or []) if row.get('key') == key]


def values_of(rows):
    """The rendered members of a key's rows, skipping a row that holds no value at all."""
    return [v for v in (render_row(r) for r in rows or []) if v is not None]


def find(match, key):
    """The values of one key. Empty when the key is absent, or present with an empty set."""
    return values_of(find_rows(match, key))


def values_in(registry, key):
    """The values of one key, off a bare registry list."""
    return values_of(rows_in(registry, key))


def load_all(match):
    """Every key of the match, each with the SET of values it holds. A key with no value at
    all maps to an empty list — never to None, so a caller never has to guard."""
    out = {}
    for row in (match or {}).get('registry') or []:
        key = row.get('key')
        if key:
            value = render_row(row)
            bucket = out.setdefault(key, [])
            if value is not None:
                bucket.append(value)
    return out


def condition_met(source, key_field, value_field, operator_field, match):
    """A registry condition read off an authored row (an edge, a weather rule, an event).

    A blank key is no condition at all; anything else goes through ``evaluate``, so a key
    with no expected value is never met — the reading events and movement always had.
    """
    key = (source or {}).get(key_field)
    if no_condition(key):
        return True
    return evaluate((source or {}).get(operator_field),
                    (source or {}).get(value_field), find(match, key))


def list_entries(match, story, include_hidden=False):
    """The rows joined with their story key definition — category, visibility, priority and
    card id. A row whose key the story no longer declares is kept but reads as hidden: it is
    state the engine wrote, and dropping it silently would hide a bug rather than a key."""
    definitions = {}
    for k in (story or {}).get('keys') or []:
        name = k.get('keyName') or k.get('name')
        if name:
            definitions[name] = k

    # Step 36.1 — one entry per KEY, holding its whole set. The keys are the union of what
    # the story declares and what the match holds: a key whose members were all removed, or
    # one added to the story after this match began, still has an entry with an empty set.
    by_key = {name: [] for name in definitions}
    for row in (match or {}).get('registry') or []:
        if row.get('key'):
            by_key.setdefault(row['key'], []).append(row)

    out = []
    for name, rows in by_key.items():
        definition = definitions.get(name) or {}
        visibility = definition.get('visibility')
        last = rows[-1] if rows else {}
        entry = {
            'uuid': last.get('uuid'),
            'key': name,
            'values': ordered(values_of(rows)),
            'multiValue': is_multi(definition) if definition
                          else any(row.get('multiValue') for row in rows),
            'idCharacter': last.get('idCharacter'),
            'category': definition.get('keyGroup') or definition.get('group'),
            'visible': bool(definition) and str(visibility or '').upper() == VISIBILITY_PUBLIC,
            'priority': definition.get('priority'),
            'idCard': definition.get('idCard'),
            'card': None,
        }
        if entry['visible'] or include_hidden:
            out.append(entry)
    out.sort(key=lambda e: (e['category'] or '', e['priority'] or 0, e['key'] or ''))
    return out


def list_groups(match, story, include_hidden=False):
    """The same entries bucketed by category, keeping the order above inside each bucket."""
    groups = []
    by_category = {}
    for entry in list_entries(match, story, include_hidden):
        category = entry['category']
        if category not in by_category:
            group = {'category': category, 'entries': []}
            by_category[category] = group
            groups.append(group)
        by_category[category]['entries'].append(entry)
    return groups


# ── writes ──────────────────────────────────────────────────────────────────

def seed(story):
    """Match creation: one row per story key, holding its default and its definition."""
    rows = []
    next_id = 1
    for k in (story or {}).get('keys') or []:
        multi = is_multi(k)
        parsed = parse(k.get('keyValue') if 'keyValue' in k else k.get('value'))
        # A MULTI key with no default seeds no row at all — its set starts empty, and an
        # empty set is the absence of rows, not a row holding nothing.
        if multi and render(parsed['stringValue'], parsed['intValue']) is None:
            continue
        rows.append({
            'id': next_id,
            'uuid': str(_uuid.uuid4()),
            'key': k.get('keyName') or k.get('name') or '',
            'stringValue': parsed['stringValue'],
            'intValue': parsed['intValue'],
            'multiValue': 1 if multi else 0,
            'idCharacter': None,
        })
        next_id += 1
    return rows


def upsert(match, key, value, changes=None, id_character=None, id_event=None,
           id_choice=None, clock=None, character_uuid=None, timestamp=None, story=None):
    """Write one key on the match item. A blank key is authored noise and is skipped.

    Whether the value REPLACES the key or JOINS it is decided by the rows already there —
    their ``multiValue`` mirror — and only by the story's declaration when the key has no row
    yet. That is what lets an author flip the flag without disturbing a match already in
    progress: a running match keeps the behaviour it was born with.

    The registry is match-scoped: written once per effect row, never once per recipient.
    """
    if no_condition(key):
        return None
    registry = match.setdefault('registry', [])
    rows = rows_in(registry, key)
    multi = bool(rows[0].get('multiValue')) if rows else is_multi(_definition(story, key))
    before = values_of(rows)
    parsed = parse(value)
    rendered = render(parsed['stringValue'], parsed['intValue'])

    if not multi:
        row = rows[0] if rows else None
        if row is None:
            row = {'id': _next_id(registry), 'uuid': str(_uuid.uuid4()), 'key': key,
                   'multiValue': 0}
            registry.append(row)
        row['stringValue'] = parsed['stringValue']
        row['intValue'] = parsed['intValue']
        _stamp(row, id_character, id_event, id_choice, clock)
        after = [] if rendered is None else [rendered]
        return _written(match, key, before, after, changes,
                        f'{key} {_joined(before)} -> {value}',
                        id_event, clock, character_uuid, timestamp)

    # A set: adding a member it already holds changes nothing, so it says nothing either.
    if rendered is None or any(_eq(v, rendered) for v in before):
        return _unchanged(key, before, changes)
    row = {'id': _next_id(registry), 'uuid': str(_uuid.uuid4()), 'key': key, 'multiValue': 1,
           'stringValue': parsed['stringValue'], 'intValue': parsed['intValue']}
    _stamp(row, id_character, id_event, id_choice, clock)
    registry.append(row)
    return _written(match, key, before, ordered(before + [rendered]), changes,
                    f'{key} +{rendered}', id_event, clock, character_uuid, timestamp)


def remove(match, key, value, changes=None, id_character=None, id_event=None,
           id_choice=None, clock=None, character_uuid=None, timestamp=None):
    """Take one value away. On a single key this is the compare-and-clear it has always been;
    on a multi key it removes that one member and leaves the rest. Removing the last member
    leaves the key with an empty set — the row goes, the key does not."""
    if no_condition(key):
        return None
    registry = match.setdefault('registry', [])
    rows = rows_in(registry, key)
    before = values_of(rows)
    if not rows:
        return _unchanged(key, before, changes)
    parsed = parse(value)
    rendered = render(parsed['stringValue'], parsed['intValue'])

    if not rows[0].get('multiValue'):
        if rendered is None or not _eq(rendered, render_row(rows[0])):
            return _unchanged(key, before, changes)  # a value the story has moved on from
        rows[0]['stringValue'] = None
        rows[0]['intValue'] = None
        _stamp(rows[0], id_character, id_event, id_choice, clock)
        return _written(match, key, before, [], changes, f'{key} {rendered} -> None',
                        id_event, clock, character_uuid, timestamp)

    # The member is named case-blind but removed as stored, or the removal matches nothing.
    stored = None if rendered is None else _first_matching(rows, rendered)
    if stored is None:
        return _unchanged(key, before, changes)
    stored_value = render_row(stored)
    registry.remove(stored)
    after = list(before)
    after.remove(stored_value)
    return _written(match, key, before, ordered(after), changes, f'{key} -{stored_value}',
                    id_event, clock, character_uuid, timestamp)


def _definition(story, key):
    for k in (story or {}).get('keys') or []:
        if (k.get('keyName') or k.get('name')) == key:
            return k
    return None


def _next_id(registry):
    return max([r.get('id') or 0 for r in registry] or [0]) + 1


def _stamp(row, id_character, id_event, id_choice, clock):
    row['idCharacter'] = id_character
    row['idEvent'] = id_event
    row['idChoice'] = id_choice
    row['clock'] = clock


def _joined(values):
    """A set as one string for the change payload: empty reads as None, as it did."""
    if not values:
        return None
    return values[0] if len(values) == 1 else ','.join(values)


def _unchanged(key, before, changes):
    """A write the registry refused — a duplicate member, or a value some other branch has
    moved on from — changed nothing, so it reports nothing. ``changes`` is left untouched."""
    return {'key': key, 'oldValue': _joined(before), 'newValue': _joined(before),
            'values': before, 'message': None}


def _written(match, key, before, after, changes, detail, id_event, clock,
             character_uuid, timestamp):
    old, new = _joined(before), _joined(after)
    if changes is not None:
        changes.append({'key': key, 'oldValue': old, 'newValue': new})
    # One writer, one audit row: a registry change can neither be missed nor doubled.
    message = f'{MSG_REGISTRY_CHANGE} {detail}'
    match.setdefault('eventLog', []).append({
        'message': message,
        'clock': clock,
        'timestamp': timestamp,
        'characterUuid': character_uuid,
        'idEvent': id_event,
    })
    return {'key': key, 'oldValue': old, 'newValue': new, 'values': after,
            'message': message}
