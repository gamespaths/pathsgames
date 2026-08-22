"""Edge-case coverage for match/events.py helpers: numeric coercion, clamping,
registry context building, item/trait application and the coma roster guard."""
from match import events


# ── _nz / _clamp ─────────────────────────────────────────────────────────────

def test_nz_coerces_and_defaults_to_zero():
    assert events._nz(None) == 0
    assert events._nz('') == 0
    assert events._nz('7') == 7
    assert events._nz('not-a-number') == 0
    assert events._nz([]) == 0


def test_clamp_open_upper_bound():
    assert events._clamp(-5, 0, None) == 0
    assert events._clamp(99, 0, None) == 99


def test_clamp_inverted_bounds_returns_low():
    assert events._clamp(5, 10, 3) == 10


def test_clamp_normal_bounds():
    assert events._clamp(15, 0, 10) == 10
    assert events._clamp(-1, 0, 10) == 0


# ── build_context registry coercion ──────────────────────────────────────────

def _ctx(registry):
    match = {'registry': registry}
    caller = {'uuid': 'c1', 'idLocation': 1}
    return events.build_context(match, {}, caller)


def test_build_context_skips_keyless_registry_rows():
    ctx = _ctx([{'stringValue': 'orphan'}, {'key': 'a', 'stringValue': 'A'}])
    assert ctx['registry'] == {'a': 'A'}


def test_build_context_stringifies_int_registry_values():
    ctx = _ctx([{'key': 'n', 'intValue': 12}])
    assert ctx['registry']['n'] == '12'


def test_build_context_null_registry_value_stays_none():
    ctx = _ctx([{'key': 'empty'}])
    assert ctx['registry']['empty'] is None


# ── apply_stat ───────────────────────────────────────────────────────────────

def test_apply_stat_without_statistic_is_a_noop():
    char, changes = {'uuid': 'c1'}, []
    assert events.apply_stat(char, {'statistics': '  '}, changes) is False
    assert changes == []


def test_apply_stat_clamps_at_max():
    char = {'uuid': 'c1', 'life': 8, 'lifeMax': 10}
    changes = []
    events.apply_stat(char, {'statistics': 'life', 'value': 5}, changes)
    assert char['life'] == 10


def test_apply_stat_never_goes_below_zero():
    char = {'uuid': 'c1', 'energy': 2, 'energyMax': 10}
    events.apply_stat(char, {'statistics': 'energy', 'value': -9}, [])
    assert char['energy'] == 0


def test_apply_stat_maps_short_names_to_fields():
    char = {'uuid': 'c1', 'dexterity': 1}
    events.apply_stat(char, {'statistics': 'dex', 'value': 2}, [])
    assert char['dexterity'] == 3


# ── apply_item ───────────────────────────────────────────────────────────────

def test_apply_item_add_creates_then_stacks():
    char, changes = {'uuid': 'c1'}, []
    effect = {'idItemTarget': 5, 'itemAction': events.ADD}
    added, removed = events.apply_item(char, effect, {5: 'item-5'}, changes)
    assert (added, removed) == (True, False)
    assert len(char['items']) == 1
    assert char['items'][0]['idItem'] == 5
    assert char['items'][0]['amount'] == 1
    # Step 34 — the row gets its own uuid at creation.
    first_uuid = char['items'][0]['uuid']
    assert first_uuid
    events.apply_item(char, effect, {5: 'item-5'}, changes)
    assert char['items'][0]['amount'] == 2
    assert char['items'][0]['uuid'] == first_uuid, "stacking must not re-issue the uuid"


def test_apply_item_remove_takes_every_unit():
    """v0.35.1 — a story that takes an item away takes all of it, not one unit."""
    char = {'uuid': 'c1', 'items': [{'idItem': 5, 'amount': 2}]}
    changes = []
    effect = {'idItemTarget': 5, 'itemAction': events.REMOVE}

    added, removed = events.apply_item(char, effect, {5: 'item-5'}, changes)

    assert (added, removed) == (False, True)
    assert char['items'] == []


def test_apply_item_add_is_refused_at_the_cap():
    """max_per_character: the unit does not go in, and it is not an error — the change is
    reported as NOT_ADDED so the board can say so if it wants to."""
    char = {'uuid': 'c1', 'items': [{'idItem': 5, 'amount': 2}]}
    changes = []
    effect = {'idItemTarget': 5, 'itemAction': events.ADD}

    assert events.apply_item(char, effect, {5: 'item-5'}, changes, 2) == (False, False)

    assert char['items'][0]['amount'] == 2
    assert changes == [{'characterUuid': 'c1', 'itemUuid': 'item-5', 'action': 'NOT_ADDED'}]


def test_apply_item_add_under_the_cap_and_a_cap_of_zero():
    char, changes = {'uuid': 'c1', 'items': [{'idItem': 5, 'amount': 1}]}, []
    assert events.apply_item(char, {'idItemTarget': 5, 'itemAction': events.ADD},
                             {5: 'item-5'}, changes, 2) == (True, False)
    assert char['items'][0]['amount'] == 2
    # 0 is no cap at all, the same reading the class gates have.
    assert events.apply_item(char, {'idItemTarget': 5, 'itemAction': events.ADD},
                             {5: 'item-5'}, changes, 0) == (True, False)
    assert char['items'][0]['amount'] == 3


def test_apply_item_folds_duplicate_rows_an_older_build_may_have_left():
    """One row per (character, item) since v0.35.1: two halves of a quantity would let the
    cap through twice."""
    char = {'uuid': 'c1', 'items': [{'idItem': 5, 'amount': 2}, {'idItem': 5, 'amount': 3}]}
    changes = []

    # 2 + 3 = 5, and the cap is 5: read row by row the add would have slipped through.
    assert events.apply_item(char, {'idItemTarget': 5, 'itemAction': events.ADD},
                             {5: 'item-5'}, changes, 5) == (False, False)

    assert len(char['items']) == 1
    assert char['items'][0]['amount'] == 5


def test_apply_item_remove_absent_item_is_a_noop():
    char, changes = {'uuid': 'c1', 'items': []}, []
    assert events.apply_item(char, {'idItemTarget': 9, 'itemAction': events.REMOVE}, {}, changes) == (False, False)
    assert changes == []


# ── apply_traits ─────────────────────────────────────────────────────────────

def test_apply_traits_add_is_idempotent_and_remove_works():
    char, changes = {'uuid': 'c1'}, []
    uuids = {1: 't-1', 2: 't-2'}
    events.apply_traits(char, {'traitsToAdd': '1,2'}, uuids, changes)
    assert char['traitUuids'] == ['t-1', 't-2']
    events.apply_traits(char, {'traitsToAdd': '1'}, uuids, changes)
    assert char['traitUuids'] == ['t-1', 't-2']   # no duplicate
    events.apply_traits(char, {'traitsToRemove': '1'}, uuids, changes)
    assert char['traitUuids'] == ['t-2']
    assert changes[-1]['action'] == events.REMOVE


def test_apply_traits_remove_unknown_id_is_a_noop():
    char, changes = {'uuid': 'c1', 'traitUuids': ['t-1']}, []
    events.apply_traits(char, {'traitsToRemove': '99'}, {1: 't-1'}, changes)
    assert char['traitUuids'] == ['t-1']
    assert changes == []


# ── apply_registry ───────────────────────────────────────────────────────────

def test_apply_registry_creates_a_new_row():
    match, changes = {}, []
    events.apply_registry(match, 'gate', 'OPEN', changes)
    assert any(r.get('key') == 'gate' for r in match['registry'])


def test_apply_registry_reads_previous_int_value_as_string():
    match = {'registry': [{'key': 'n', 'intValue': 3}]}
    changes = []
    events.apply_registry(match, 'n', '4', changes)
    assert changes[0]['oldValue'] == '3'


# ── all_in_coma ──────────────────────────────────────────────────────────────

def test_all_in_coma_empty_roster_is_false():
    assert events.all_in_coma([]) is False
    assert events.all_in_coma(None) is False


def test_all_in_coma_requires_every_character():
    assert events.all_in_coma([{'isComa': 1}, {'isComa': 1}]) is True
    assert events.all_in_coma([{'isComa': 1}, {'isComa': 0}]) is False
