"""Steps 34 & 35 — inventory and resources for the AWS backend.

Mirrors ``InventoryService.java`` / ``inventory_service.py``, but the storage is not the
same shape: there is no inventory table on DynamoDB. A character's items are an embedded
list on its own item, ``[{"uuid", "idItem", "amount", "state"}]``, written by
:func:`events.apply_item`. So use-item and drop-item mutate a list — they do not delete a
row — and the usage log is an embedded list on the match item, exactly like ``eventLog``.

Naming trap, on purpose: at the lambda layer the effect dicts are camelCase
(``idItemTarget``, ``itemAction``, ``effectCode``), never the snake_case of the SQL-facing
python backend. Copying that code verbatim raises KeyError.

Everything here is a pure function over already-loaded dicts, so the handler stays a thin
router and the whole surface is unit-testable without DynamoDB.
"""

_RUNNING = "RUNNING"

#: The ONE genuine divergence between the item vocabulary the schema documents
#: (LIFE, ENERGY, EXP, SADNESS, DEX, INT, COS, FOOD, MAGIC, COIN) and the token the engine
#: acts on. Every other code differs only by case, and apply_stat already lowercases.
#: Applied on the ITEM path only: normalising inside the engine would silently widen the
#: event and choice vocabularies too, and diverge from the Java and python twins.
_EFFECT_CODE_ALIASES = {"sadness": "sad", "coins": "coin"}


def _nz(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def normalize_effect_code(effect_code):
    """Case-insensitive. An unknown code is lowercased rather than rejected, so the engine
    keeps treating it as authored noise instead of failing the whole usage."""
    if effect_code is None or not str(effect_code).strip():
        return None
    key = str(effect_code).strip().lower()
    return _EFFECT_CODE_ALIASES.get(key, key)


def unit_amount(amount):
    """A null amount counts as one — the movement gate must agree with this."""
    return _nz(amount) if amount is not None else 1


def items_by_id(story):
    """The story items keyed by id. Story sub-entities are embedded lists here."""
    return {_nz(i.get("id")): i for i in (story.get("items") or []) if i.get("id") is not None}


def carried_weight(char, story):
    """Sigma (item.weight x amount), the formula the match /info endpoint reports.

    An unknown item weighs 0, a null weight 0 and a null amount 1. The movement gate and
    /info MUST agree, or the board would show a weight nothing acts on.
    """
    by_id = items_by_id(story)
    total = 0
    for row in (char.get("items") or []):
        item = by_id.get(_nz(row.get("idItem")))
        weight = _nz(item.get("weight")) if item else 0
        total += weight * unit_amount(row.get("amount"))
    return total


def find_own_row(char, item_instance_uuid):
    """The caller's own rows are the only ones ever searched, so another player's item is
    indistinguishable from one that does not exist. That masking IS the ownership rule."""
    if not item_instance_uuid or not str(item_instance_uuid).strip():
        return None
    for row in (char.get("items") or []):
        if row.get("uuid") == item_instance_uuid:
            return row
    return None


def check(match, char, item, *, require_consumable):
    """The refusal, in the order the other gameplay engines use.

    Returns an error code or None. ``item`` may be None — a row whose story item is gone,
    because the story was re-imported under the character's feet.

    A dangling row is fatal only to USING: the effects, the consumable flag and the class
    gates all live on the story item, so without it there is nothing to apply. DROPPING it
    must still work — otherwise a re-import could strand a row in the bag forever, weighing
    the character down with no way to put it back. Java and Python drop it the same way, and
    report a null itemUuid.
    """
    if (match or {}).get("status") != _RUNNING:
        return "MATCH_NOT_RUNNING"
    if _nz(char.get("isComa")):
        return "COMA"
    if _nz(char.get("isSleeping")):
        return "SLEEPING"
    if not require_consumable:
        return None
    if item is None:
        return "ITEM_NOT_FOUND"
    if _nz(item.get("isConsumabile")) != 1:
        return "ITEM_NOT_CONSUMABLE"
    return check_class_gate(char, item)


def check_class_gate(char, item):
    """0 or None means "no restriction": the CRUD writes a raw 0 where the importer
    writes None, and both have to read as unset."""
    permitted = _nz(item.get("idClassPermitted"))
    prohibited = _nz(item.get("idClassProhibited"))
    id_class = item_class_of(char)
    if permitted > 0 and permitted != id_class:
        return "ITEM_CLASS_NOT_PERMITTED"
    if prohibited > 0 and id_class is not None and prohibited == id_class:
        return "ITEM_CLASS_PROHIBITED"
    return None


def item_class_of(char):
    """The character's story class id; None when it joined without one."""
    value = char.get("idClass")
    return _nz(value) if value is not None else None


def standalone_effects(story, item):
    """The item's list_items_effects rows, reduced to what apply_stat/apply_traits read.

    The statistic is normalised here and only here, so an item effect and an event effect
    reach the very same engine code and trip the very same step-30 edge states.
    """
    item_id = _nz(item.get("id"))
    out = []
    for effect in (story.get("itemEffects") or []):
        if _nz(effect.get("idItem")) != item_id:
            continue
        out.append({
            "uuid": effect.get("uuid"),
            "idCard": effect.get("idCard"),
            "statistics": normalize_effect_code(effect.get("effectCode")),
            "value": _nz(effect.get("effectValue")),
            "traitsToAdd": effect.get("traitsToAdd"),
            "traitsToRemove": effect.get("traitsToRemove"),
        })
    return out


def remove_row(char, row):
    """Both use-item and drop-item discard the WHOLE row: amount is never decremented."""
    items = char.get("items") or []
    if row in items:
        items.remove(row)
    char["items"] = items


def log_item_usage(match, char, id_item, clock, effects):
    """Appends to the match item's ``itemUsageLog``.

    There is no log table on DynamoDB: the existing logs (``eventLog``) are embedded lists
    on the match METADATA item, persisted by the same put_item the caller already does.
    """
    match.setdefault("itemUsageLog", []).append({
        "characterUuid": char.get("uuid"),
        "idItem": _nz(id_item),
        "counter": 1,
        "clock": _nz(clock),
        "effects": effects,
    })
