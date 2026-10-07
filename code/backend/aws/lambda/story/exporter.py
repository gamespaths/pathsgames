"""v0.41.4 Step 41 H — the internal story exporter: the admin header plus the 22 admin CRUD lists,
tsInsert/tsUpdate/idStory removed, text ids fixed, nulls stripped (react-admin StoriesPage export)."""
import copy

# Admin CRUD entity type and JSON key, in the react-admin export order.
ENTITY_TYPES = (
    ('texts', 'texts'), ('difficulties', 'difficulties'), ('classes', 'classes'), ('locations', 'locations'),
    ('events', 'events'), ('items', 'items'), ('choices', 'choices'), ('creators', 'creators'),
    ('cards', 'cards'), ('keys', 'keys'), ('traits', 'traits'), ('character-templates', 'characterTemplates'),
    ('weather-rules', 'weatherRules'), ('global-random-events', 'globalRandomEvents'), ('missions', 'missions'),
    ('location-neighbors', 'locationNeighbors'), ('event-effects', 'eventEffects'),
    ('choice-conditions', 'choiceConditions'), ('choice-effects', 'choiceEffects'),
    ('item-effects', 'itemEffects'), ('class-bonuses', 'classBonuses'), ('mission-steps', 'missionSteps'),
)
_DROPPED = ('tsInsert', 'tsUpdate', 'idStory')


def strip_nulls(value):
    """Null-valued keys removed at any depth; arrays keep their length; Decimal to int/float."""
    from decimal import Decimal
    if isinstance(value, dict):
        return {k: strip_nulls(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [strip_nulls(v) for v in value]
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def _as_int(value):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def export_story_item(item):
    """The story import JSON of a STORY# item; None for a missing item."""
    if not item:
        return None
    from story import handler
    data = {k: v for k, v in handler._story_detail(item, 'en').items() if k not in ('tsInsert', 'tsUpdate')}
    for entity_type, json_key in ENTITY_TYPES:
        rows = copy.deepcopy(item.get(handler.TYPE_MAP[entity_type]) or [])
        out = []
        for i, e in enumerate(rows):
            if e.get('id') is None:
                e['id'] = _as_int(e['id_tipo']) if e.get('id_tipo') is not None else i + 1
            row = {k: v for k, v in handler._normalize_entity_output(entity_type, e).items() if k not in _DROPPED}
            if json_key == 'texts' and e.get('idText') is not None:
                row['id'] = row['idText'] = _as_int(e.get('idText'))
            out.append(row)
        data[json_key] = out
    return strip_nulls(data)
