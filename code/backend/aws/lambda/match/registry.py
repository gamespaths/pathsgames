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

def no_condition(key):
    """True when the condition is absent altogether — a blank key means "no condition"."""
    return key is None or not str(key).strip()


def evaluate(operator, expected, actual):
    """The one registry comparison.

    ``=`` and ``!=`` are textual, ``>`` and ``<`` need both sides numeric. A None expected
    value, an unparseable operand or an unknown operator is NOT met: a typo must lock a door,
    never open one. An absent key satisfies only ``!=``.
    """
    if expected is None:
        return False
    op = OP_EQ if operator is None or not str(operator).strip() else str(operator).strip()
    if op == OP_EQ:
        return expected == actual
    if op == OP_NE:
        return expected != actual
    if op in (OP_GT, OP_LT):
        a, e = _numeric(actual), _numeric(expected)
        if a is None or e is None:
            return False
        return a > e if op == OP_GT else a < e
    return False


# ── reads ───────────────────────────────────────────────────────────────────

def find_row(match, key):
    """The raw row of a key on the match item, or None when it is absent."""
    for row in (match or {}).get('registry') or []:
        if row.get('key') == key:
            return row
    return None


def find(match, key):
    """One key, rendered. None means absent, or present with no value."""
    return render_row(find_row(match, key))


def load_all(match):
    """Every key of the match as one dict. A row with no value maps its key to None."""
    out = {}
    for row in (match or {}).get('registry') or []:
        key = row.get('key')
        if key:
            out[key] = render_row(row)
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
    out = []
    for row in (match or {}).get('registry') or []:
        definition = definitions.get(row.get('key')) or {}
        visibility = definition.get('visibility')
        entry = {
            'uuid': row.get('uuid'),
            'key': row.get('key'),
            'stringValue': row.get('stringValue'),
            'intValue': row.get('intValue'),
            'idCharacter': row.get('idCharacter'),
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
        parsed = parse(k.get('keyValue') if 'keyValue' in k else k.get('value'))
        rows.append({
            'id': next_id,
            'uuid': str(_uuid.uuid4()),
            'key': k.get('keyName') or k.get('name') or '',
            'stringValue': parsed['stringValue'],
            'intValue': parsed['intValue'],
            'idCharacter': None,
        })
        next_id += 1
    return rows


def upsert(match, key, value, changes=None, id_character=None, id_event=None,
           id_choice=None, clock=None, character_uuid=None, timestamp=None):
    """Set one key on the match item. A blank key is authored noise and is skipped.

    The registry is match-scoped: written once per effect row, never once per recipient.
    A row created here carries an id and a uuid, exactly like a seeded one — before Step 36
    it did not, and the /info payload held two differently shaped rows on the same match.
    """
    if no_condition(key):
        return None
    registry = match.setdefault('registry', [])
    row = find_row(match, key)
    old = render_row(row)
    if row is None:
        row = {
            'id': max([r.get('id') or 0 for r in registry] or [0]) + 1,
            'uuid': str(_uuid.uuid4()),
            'key': key,
        }
        registry.append(row)
    parsed = parse(value)
    row['stringValue'] = parsed['stringValue']
    row['intValue'] = parsed['intValue']
    row['idCharacter'] = id_character
    row['idEvent'] = id_event
    row['idChoice'] = id_choice
    row['clock'] = clock
    if changes is not None:
        changes.append({'key': key, 'oldValue': old, 'newValue': value})
    # One writer, one audit row: a registry change can neither be missed nor doubled.
    message = f'{MSG_REGISTRY_CHANGE} {key} {old} -> {value}'
    match.setdefault('eventLog', []).append({
        'message': message,
        'clock': clock,
        'timestamp': timestamp,
        'characterUuid': character_uuid,
        'idEvent': id_event,
    })
    return {'key': key, 'oldValue': old, 'newValue': value, 'message': message}
