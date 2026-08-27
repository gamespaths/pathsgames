"""Step23Helper — pure-python helpers for the Step 23 trait-selection suite.

The robot tests resolve their data dynamically from a public story's detail
(uuids are seed-generated), so these helpers search the detail JSON for the
combinations each scenario needs. Every function returns ``None``-friendly
structures so a suite can skip a scenario when the running backend's seed
does not expose it (e.g. the Python seed has no class-restricted traits).
"""


def _nz(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _is_hidden(trait):
    """v0.35.2 — the story keeps this trait out of the start-match page.

    The API still RETURNS it (the same list resolves the traits a character already owns),
    so every helper that answers "what could a player pick" has to filter it out itself —
    the server refuses it with TRAIT_NOT_SELECTABLE.
    """
    return bool(trait.get("hideOnStartMatch"))


def _is_selectable(trait, class_id):
    """Whether the CLASS gates allow the trait — nothing else.

    This is what `GET /classes/{uuid}/traits` answers, and that endpoint deliberately keeps
    returning a hidden trait (the same list resolves the traits a character already owns).
    "Could a player pick it" is a different question: see :func:`_is_pickable`.
    """
    permitted = trait.get("idClassPermitted")
    prohibited = trait.get("idClassProhibited")
    permitted_ok = permitted is None or (class_id is not None and int(permitted) == int(class_id))
    prohibited_ok = prohibited is None or class_id is None or int(prohibited) != int(class_id)
    return permitted_ok and prohibited_ok


def _is_pickable(trait, class_id):
    """v0.35.2 — what a player may actually CHOOSE: the class gates and not hidden.

    The server refuses a hidden trait at join with TRAIT_NOT_SELECTABLE, so any scenario
    that goes on to join has to build its selection out of these.
    """
    return _is_selectable(trait, class_id) and not _is_hidden(trait)


def filtered_trait_uuids(detail, class_uuid):
    """The trait uuids the per-class ENDPOINT returns: the class filter alone, hidden ones
    included. Use :func:`pickable_trait_uuids` to build something to join with."""
    clazz = next((c for c in (detail.get("classes") or []) if c.get("uuid") == class_uuid), None)
    class_id = clazz.get("id") if clazz else None
    return [t.get("uuid") for t in (detail.get("traits") or []) if _is_selectable(t, class_id)]


def pickable_trait_uuids(detail, class_uuid):
    """v0.35.2 — the trait uuids a player could select with the given class."""
    clazz = next((c for c in (detail.get("classes") or []) if c.get("uuid") == class_uuid), None)
    class_id = clazz.get("id") if clazz else None
    return [t.get("uuid") for t in (detail.get("traits") or []) if _is_pickable(t, class_id)]


def find_incompatible_trait(detail, class_uuid):
    """A trait uuid refused for the CLASS, or '' when none exists.

    A hidden trait is skipped on purpose: it is refused too, but with
    TRAIT_NOT_SELECTABLE, and the scenario that calls this asserts
    TRAIT_NOT_COMPATIBLE. Two refusals, two searches.
    """
    clazz = next((c for c in (detail.get("classes") or []) if c.get("uuid") == class_uuid), None)
    class_id = clazz.get("id") if clazz else None
    for t in detail.get("traits") or []:
        if _is_hidden(t):
            continue
        if not _is_selectable(t, class_id):
            return t.get("uuid") or ""
    return ""


def find_positive_budget_overflow(detail):
    """Finds (class_uuid, [trait_uuids]) whose summed costPositive exceeds the
    first difficulty's traitCostPositiveBudget, using only traits compatible
    with that class. Returns ('', []) when no such combination exists."""
    difficulties = detail.get("difficulties") or []
    budget = difficulties[0].get("traitCostPositiveBudget") if difficulties else None
    if budget is None:
        return "", []
    for clazz in detail.get("classes") or []:
        class_id = clazz.get("id")
        compatible = [t for t in (detail.get("traits") or []) if _is_pickable(t, class_id)]
        positives = [t for t in compatible if _nz(t.get("costPositive")) > 0]
        selection = []
        total = 0
        for t in positives:
            selection.append(t.get("uuid"))
            total += _nz(t.get("costPositive"))
            if total > int(budget):
                return clazz.get("uuid") or "", selection
    return "", []


def find_negative_budget_overflow(detail):
    """Same as find_positive_budget_overflow but for costNegative against the
    first difficulty's traitCostNegativeBudget."""
    difficulties = detail.get("difficulties") or []
    budget = difficulties[0].get("traitCostNegativeBudget") if difficulties else None
    if budget is None:
        return "", []
    for clazz in detail.get("classes") or []:
        class_id = clazz.get("id")
        compatible = [t for t in (detail.get("traits") or []) if _is_pickable(t, class_id)]
        negatives = [t for t in compatible if _nz(t.get("costNegative")) > 0]
        selection = []
        total = 0
        for t in negatives:
            selection.append(t.get("uuid"))
            total += _nz(t.get("costNegative"))
            if total > int(budget):
                return clazz.get("uuid") or "", selection
    return "", []


def find_null_budget_difficulty(detail):
    """The uuid of the first difficulty whose positive AND negative budgets are both
    NULL (unlimited), or '' when none exists."""
    for d in detail.get("difficulties") or []:
        if d.get("traitCostPositiveBudget") is None and d.get("traitCostNegativeBudget") is None:
            return d.get("uuid") or ""
    return ""


def find_permitted_match_trait(detail, class_uuid):
    """A trait uuid whose idClassPermitted equals the given class id (happy path of
    the permitted filter), or '' when none exists."""
    clazz = next((c for c in (detail.get("classes") or []) if c.get("uuid") == class_uuid), None)
    class_id = clazz.get("id") if clazz else None
    if class_id is None:
        return ""
    for t in detail.get("traits") or []:
        permitted = t.get("idClassPermitted")
        if _is_hidden(t):
            continue
        if permitted is not None and int(permitted) == int(class_id):
            return t.get("uuid") or ""
    return ""


def find_prohibited_other_trait(detail, class_uuid):
    """A trait uuid that has idClassProhibited set to a class different from the given
    one (so it stays selectable with it), or '' when none exists."""
    clazz = next((c for c in (detail.get("classes") or []) if c.get("uuid") == class_uuid), None)
    class_id = clazz.get("id") if clazz else None
    for t in detail.get("traits") or []:
        prohibited = t.get("idClassProhibited")
        if prohibited is not None and (class_id is None or int(prohibited) != int(class_id)) \
                and _is_pickable(t, class_id):
            return t.get("uuid") or ""
    return ""


def find_two_compatible_traits(detail, class_uuid):
    """Up to two distinct trait uuids a player could pick with the given class. Returns fewer
    than two when the seed does not expose enough compatible traits."""
    clazz = next((c for c in (detail.get("classes") or []) if c.get("uuid") == class_uuid), None)
    class_id = clazz.get("id") if clazz else None
    uuids = [t.get("uuid") for t in (detail.get("traits") or []) if _is_pickable(t, class_id)]
    return uuids[:2]


def sum_trait_stat_deltas(detail, trait_uuids):
    """The summed stat deltas (life, energy, dexterity, intelligence, constitution)
    across the given trait uuids."""
    total = {"life": 0, "energy": 0, "dexterity": 0, "intelligence": 0, "constitution": 0}
    for uuid in trait_uuids:
        deltas = trait_stat_deltas(detail, uuid)
        for k in total:
            total[k] += deltas[k]
    return total


def trait_stat_deltas(detail, trait_uuid):
    """The five stat deltas of a trait as a dict (life, energy, dexterity,
    intelligence, constitution) — the fields applied at character creation."""
    trait = next((t for t in (detail.get("traits") or []) if t.get("uuid") == trait_uuid), {})
    return {
        "life": _nz(trait.get("life")),
        "energy": _nz(trait.get("energy")),
        "dexterity": _nz(trait.get("dexterity")),
        "intelligence": _nz(trait.get("intelligence")),
        "constitution": _nz(trait.get("constitution")),
    }
