"""Step 31 — the choice engine for the AWS backend.

Mirrors ``ChoiceAvailabilityChecker.java`` / ``choice_availability.py``: one pure verdict
per option, evaluated against a pre-loaded context — non-available options are still
returned (shown disabled), never dropped.

Storage note: on this backend the choices live embedded on the STORY item as the
``choices`` / ``choiceConditions`` / ``choiceEffects`` lists (camelCase, straight from the
import JSON), and the open-cycle markers ride on the MATCH item's ``eventLog``.

Evaluation contract, in order:

1. ``otherwiseFlag = 1`` wins outright (INV-29): limits and conditions are not even read.
2. The inline limits combine in AND, before the condition rows: ``limitDex`` /
   ``limitInt`` / ``limitCos`` are minimum requirements (stat >= limit) while
   ``limitSad`` is a maximum (sad <= limit). A null limit is no constraint.
3. The condition rows combine under the choice's ``logicOperator`` (INV-31: all-AND or
   all-OR, never mixed). Under AND the first failing row names the reason; under OR one
   passing row is enough (aggregate CONDITIONS_NOT_MET when none). No rows = available.

An unknown type, an unparseable value or a blank key make that condition NOT met: a typo
locks the option visibly rather than silently unlocking it.
"""

from match.events import _nz  # noqa: F401 — the shared null-safe int coercion

# Marker of a resolved choice-event cycle. Step 31 only READS it: a choice-event is
# "open" (serve the options again, charge nothing) while its EVENT_EXECUTED rows
# outnumber its CHOICE_SELECTED rows. Contract for Step 32, the first writer: the
# eventLog entry's message starts with this prefix and its idEvent carries the OWNING
# EVENT id (not the choice id), so count_log_markers can pair the markers by event.
MSG_CHOICE_SELECTED = "CHOICE_SELECTED"

# ── reason vocabulary (per-option, returned on the response) ────────────────
LIMIT_SAD_EXCEEDED = "LIMIT_SAD_EXCEEDED"
LIMIT_DEX_NOT_MET = "LIMIT_DEX_NOT_MET"
LIMIT_INT_NOT_MET = "LIMIT_INT_NOT_MET"
LIMIT_COS_NOT_MET = "LIMIT_COS_NOT_MET"
CONDITION_KEYS_NOT_MET = "CONDITION_KEYS_NOT_MET"
CONDITION_ITEM_NOT_MET = "CONDITION_ITEM_NOT_MET"
CONDITION_CLASS_NOT_MET = "CONDITION_CLASS_NOT_MET"
CONDITION_LOCATION_NOT_MET = "CONDITION_LOCATION_NOT_MET"
CONDITION_ALL_IN_SAME_LOC_NOT_MET = "CONDITION_ALL_IN_SAME_LOC_NOT_MET"
CONDITION_TRAITS_NOT_MET = "CONDITION_TRAITS_NOT_MET"
CONDITION_STATISTICS_NOT_MET = "CONDITION_STATISTICS_NOT_MET"
CONDITION_STATISTICS_SUM_NOT_MET = "CONDITION_STATISTICS_SUM_NOT_MET"
# OR aggregate (no single row is "the" culprit) and unknown-type fallback.
CONDITIONS_NOT_MET = "CONDITIONS_NOT_MET"

_REASON_BY_TYPE = {
    "KEYS": CONDITION_KEYS_NOT_MET,
    "ITEM": CONDITION_ITEM_NOT_MET,
    "CLASS": CONDITION_CLASS_NOT_MET,
    "LOCATION": CONDITION_LOCATION_NOT_MET,
    "ALL_IN_SAME_LOC": CONDITION_ALL_IN_SAME_LOC_NOT_MET,
    "TRAITS": CONDITION_TRAITS_NOT_MET,
    "STATISTICS": CONDITION_STATISTICS_NOT_MET,
    "STATISTICS_SUM": CONDITION_STATISTICS_SUM_NOT_MET,
}

# The stat vocabulary of the effect engine, as it sits on an AWS character item.
_STAT_FIELD = {"life": "life", "energy": "energy", "sad": "sad", "exp": "exp",
               "dex": "dexterity", "int": "intelligence", "cos": "constitution",
               "food": "food", "magic": "magic", "coin": "coin"}


def choices_for_event(story, event_id):
    """The event's choices, sorted by priority then id — the presentation order."""
    rows = [c for c in (story.get("choices") or [])
            if c.get("idEvent") is not None and _nz(c.get("idEvent")) == _nz(event_id)]
    rows.sort(key=lambda c: (_nz(c.get("priority")), _nz(c.get("id"))))
    return rows


def conditions_by_choice(story):
    """Every choiceConditions row grouped by idChoices, each list ordered by row id —
    under AND the FIRST failing row names the reason, so the order is load-bearing."""
    out = {}
    for row in sorted(story.get("choiceConditions") or [], key=lambda r: _nz(r.get("id"))):
        if row.get("idChoices") is None:
            continue
        out.setdefault(_nz(row.get("idChoices")), []).append(row)
    return out


def choice_by_uuid(story, choice_uuid):
    """Step 32 — the option select-choice names, inside the match's own story."""
    if not choice_uuid or not str(choice_uuid).strip():
        return None
    return next((c for c in (story.get("choices") or [])
                 if c.get("uuid") == choice_uuid), None)


def effects_for_choice(story, choice_id):
    """Step 32 — the option's choiceEffects rows, in authored (id) order, so a later row
    can build on what an earlier one wrote."""
    rows = [e for e in (story.get("choiceEffects") or [])
            if e.get("idChoices") is not None and _nz(e.get("idChoices")) == _nz(choice_id)]
    rows.sort(key=lambda e: _nz(e.get("id")))
    return rows


def choice_recipients(effect, actor, characters):
    """Step 32 — INV-46: ``flagGroup`` 1 means every character standing in the ACTOR's
    location, the same set an event effect's ``target=ALL`` resolves (INV-27), never every
    character of the match. Anything else is the acting character alone."""
    if _nz(effect.get("flagGroup")) != 1 or actor.get("idLocation") is None:
        return [actor]
    return [c for c in characters if c.get("idLocation") == actor.get("idLocation")]


def count_log_markers(match, event_id, prefix):
    """How many eventLog rows of the event carry a message starting with prefix."""
    return sum(
        1 for e in (match.get("eventLog") or [])
        if e.get("idEvent") is not None and _nz(e.get("idEvent")) == _nz(event_id)
        and str(e.get("message") or "").startswith(prefix)
    )


def build_choice_context(match, story, caller, characters, ctx, choices, conditions):
    """Everything the per-option verdict needs, built once for N options.

    ``ctx`` is the event check context (owned items, registry) — the caller dict already
    reflects the open-cost deduction, so the checker sees post-deduction stats. The party
    reads and the trait translation run only when some condition needs them.
    """
    needs_party = False
    needs_traits = False
    sum_keys = set()
    for choice in choices:
        for row in conditions.get(_nz(choice.get("id")), []):
            kind = str(row.get("type") or "").strip().upper()
            if kind == "ALL_IN_SAME_LOC":
                needs_party = True
            elif kind == "TRAITS":
                needs_traits = True
            elif kind == "STATISTICS_SUM":
                needs_party = True
                if str(row.get("key") or "").strip():
                    sum_keys.add(str(row.get("key")).strip().lower())

    trait_ids = set()
    if needs_traits:
        # Characters hold trait UUIDs; the conditions speak story-local ids — translate.
        ids_by_uuid = {t.get("uuid"): _nz(t.get("id"))
                       for t in (story.get("traits") or []) if t.get("uuid")}
        trait_ids = {ids_by_uuid[u] for u in (caller.get("traitUuids") or [])
                     if u in ids_by_uuid}

    party_locations = []
    party_stat_sums = {}
    if needs_party:
        for member in characters:
            party_locations.append(member.get("idLocation"))
            for key in sum_keys:
                field = _STAT_FIELD.get(key)
                if field:
                    party_stat_sums[key] = party_stat_sums.get(key, 0) \
                        + _nz(member.get(field))

    return {
        "actorStats": {name: _nz(caller.get(field))
                       for name, field in _STAT_FIELD.items()},
        "idClass": ctx.get("idClass"),
        "idLocation": caller.get("idLocation"),
        "ownedItemIds": ctx.get("ownedItemIds") or set(),
        "traitIds": trait_ids,
        "registry": ctx.get("registry") or {},
        "partyLocations": party_locations,
        "partyStatSums": party_stat_sums,
    }


def check_choice(choice, conditions, cctx):
    """The single verdict: ``(available, reason)``. ``reason`` is None when available."""
    if not choice or cctx is None:
        return False, CONDITIONS_NOT_MET
    if _nz(choice.get("otherwiseFlag")) == 1:
        return True, None
    reason = _failed_limit(choice, cctx)
    if reason:
        return False, reason
    rows = conditions or []
    if not rows:
        return True, None
    if str(choice.get("logicOperator") or "").strip().upper() == "OR":
        for row in rows:
            if _condition_met(row, cctx):
                return True, None
        return False, CONDITIONS_NOT_MET
    for row in rows:
        if not _condition_met(row, cctx):
            return False, _REASON_BY_TYPE.get(_type(row), CONDITIONS_NOT_MET)
    return True, None


# ── inline limits ───────────────────────────────────────────────────────────

def _failed_limit(choice, cctx):
    stats = cctx.get("actorStats") or {}
    if choice.get("limitSad") is not None and _nz(stats.get("sad")) > _nz(choice.get("limitSad")):
        return LIMIT_SAD_EXCEEDED
    if choice.get("limitDex") is not None and _nz(stats.get("dex")) < _nz(choice.get("limitDex")):
        return LIMIT_DEX_NOT_MET
    if choice.get("limitInt") is not None and _nz(stats.get("int")) < _nz(choice.get("limitInt")):
        return LIMIT_INT_NOT_MET
    if choice.get("limitCos") is not None and _nz(stats.get("cos")) < _nz(choice.get("limitCos")):
        return LIMIT_COS_NOT_MET
    return None


# ── condition rows ──────────────────────────────────────────────────────────

def _condition_met(row, cctx):
    kind = _type(row)
    if kind == "KEYS":
        return _keys_met(row, cctx)
    if kind == "ITEM":
        return _membership_met(row, cctx.get("ownedItemIds"))
    if kind == "CLASS":
        return _identity_met(row, cctx.get("idClass"))
    if kind == "LOCATION":
        return _identity_met(row, cctx.get("idLocation"))
    if kind == "ALL_IN_SAME_LOC":
        return _all_in_same_loc(cctx)
    if kind == "TRAITS":
        return _membership_met(row, cctx.get("traitIds"))
    if kind == "STATISTICS":
        return _stat_met(row, cctx.get("actorStats"))
    if kind == "STATISTICS_SUM":
        return _stat_met(row, cctx.get("partyStatSums"))
    return False  # an unknown type locks the option, it never unlocks it


def _keys_met(row, cctx):
    """Textual equality (the registry renders every value as a string); > and < require
    both sides numeric. An absent key satisfies only != — never set IS different."""
    key = str(row.get("key") or "").strip()
    expected = row.get("value")
    if not key or expected is None:
        return False
    actual = (cctx.get("registry") or {}).get(key)
    op = _operator(row)
    if op == "=":
        return expected == actual
    if op == "!=":
        return expected != actual
    if op in (">", "<"):
        a, e = _numeric(actual), _numeric(expected)
        if a is None or e is None:
            return False
        return a > e if op == ">" else a < e
    return False


def _membership_met(row, held):
    """ITEM / traits: the story-local id sits in ``value`` (``key`` as fallback)."""
    member_id = _id_of(row)
    if member_id is None or held is None:
        return False
    op = _operator(row)
    if op == "=":
        return member_id in held
    if op == "!=":
        return member_id not in held
    return False  # an item is owned or not: ordering it is authored noise


def _identity_met(row, actual):
    """CLASS / LOCATION: the actor either matches the id or does not."""
    expected = _id_of(row)
    if expected is None:
        return False
    op = _operator(row)
    actual_id = None if actual is None else _nz(actual)
    if op == "=":
        return expected == actual_id
    if op == "!=":
        return expected != actual_id
    return False


def _all_in_same_loc(cctx):
    """Every character of the match stands where the actor stands. Key, value and
    operator are ignored — the type IS the condition. An unplaced character (actor
    included) can never be gathered; a solo party trivially is."""
    here = cctx.get("idLocation")
    if here is None:
        return False
    return all(at is not None and _nz(at) == _nz(here)
               for at in (cctx.get("partyLocations") or []))


def _stat_met(row, stats):
    """STATISTICS / STATISTICS_SUM: ``key`` names the stat, ``value`` is numeric."""
    if stats is None:
        return False
    actual = (stats or {}).get(str(row.get("key") or "").strip().lower())
    expected = _numeric(row.get("value"))
    if actual is None or expected is None:
        return False
    actual = _nz(actual)
    op = _operator(row)
    if op == "=":
        return actual == expected
    if op == "!=":
        return actual != expected
    if op == ">":
        return actual > expected
    if op == "<":
        return actual < expected
    return False


# ── helpers ─────────────────────────────────────────────────────────────────

def _type(row):
    """The docs mix cases (KEYS but traits); the match is case-blind."""
    return str(row.get("type") or "").strip().upper()


def _operator(row):
    op = str(row.get("operator") or "").strip()
    return op if op else "="


def _id_of(row):
    from_value = _numeric(row.get("value"))
    return from_value if from_value is not None else _numeric(row.get("key"))


def _numeric(value):
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None
