"""Step 36 — the one place that reads, writes and compares the match registry."""
from unittest.mock import MagicMock

import pytest

from app.core.services.match.registry_service import (
    MSG_REGISTRY_CHANGE, RegistryService, evaluate, no_condition, ordered, parse, render,
    render_row,
)


def _row(key, string_value=None, int_value=None, id_character=None, multi_value=0):
    return {"id": 1, "uuid": f"u-{key}", "key": key, "string_value": string_value,
            "int_value": int_value, "id_character": id_character, "id_event": None,
            "id_choice": None, "clock": None, "multi_value": multi_value}


def _multi_row(key, string_value=None, int_value=None):
    return _row(key, string_value, int_value, multi_value=1)


@pytest.fixture
def store():
    return MagicMock()


@pytest.fixture
def service(store):
    return RegistryService(store)


# ── render / parse are exact inverses ────────────────────────────────────────

def test_render_prefers_the_string_then_the_int():
    assert render("WINTER", None) == "WINTER"
    assert render(None, 5) == "5"
    assert render(None, None) is None
    assert render_row(None) is None


def test_parse_splits_the_two_columns():
    assert parse("42") == {"string_value": None, "int_value": 42}
    assert parse("hi") == {"string_value": "hi", "int_value": None}


def test_parse_trims_in_both_branches():
    assert parse("  42  ")["int_value"] == 42
    assert parse("  hi  ")["string_value"] == "hi"


def test_parse_edges():
    assert parse("   ")["string_value"] == ""
    assert parse(None) == {"string_value": None, "int_value": None}


@pytest.mark.parametrize("value", ["42", "hi", "", "0", "-7"])
def test_a_parsed_value_renders_back_to_what_was_written(value):
    parsed = parse(value)
    assert render(parsed["string_value"], parsed["int_value"]) == value


# ── evaluate — the one comparison ────────────────────────────────────────────

def test_equality_is_textual():
    assert evaluate("=", "OPEN", ["OPEN"])
    assert not evaluate("=", "OPEN", ["SHUT"])
    assert evaluate("!=", "OPEN", ["SHUT"])
    assert not evaluate("!=", "OPEN", ["OPEN"])


def test_ordering_needs_both_sides_numeric():
    assert evaluate(">", "3", ["4"])
    assert not evaluate(">", "3", ["3"])
    assert evaluate("<", "3", ["2"])
    assert not evaluate(">", "3", ["many"])
    assert not evaluate("<", "lots", ["2"])


def test_an_absent_key_satisfies_only_not_equals():
    assert evaluate("!=", "OPEN", None)
    assert not evaluate("=", "OPEN", None)
    assert not evaluate(">", "1", None)


def test_a_null_expected_value_is_never_met():
    """A typo must lock a door, never open one."""
    assert not evaluate("=", None, ["OPEN"])
    assert not evaluate("!=", None, ["OPEN"])
    assert not evaluate("=", None, None)


def test_operator_defaults_to_equals_and_an_unknown_one_never_matches():
    assert evaluate(None, "OPEN", ["OPEN"])
    assert evaluate("   ", "OPEN", ["OPEN"])
    assert evaluate(" = ", "OPEN", ["OPEN"])
    assert not evaluate("~=", "OPEN", ["OPEN"])


# ── Step 36.1 — the comparison quantifies over the whole set ─────────────────

def test_equals_asks_whether_any_member_matches():
    assert evaluate("=", "B", ["A", "B"])
    assert not evaluate("=", "C", ["A", "B"])
    assert evaluate("!=", "C", ["A", "B"])
    assert not evaluate("!=", "A", ["A", "B"])


def test_greater_and_less_ask_every_member_and_an_empty_set_never_answers_yes():
    assert evaluate(">", "3", ["5", "7"])
    assert not evaluate(">", "3", ["2", "7"])
    assert evaluate("<", "3", ["1", "2"])
    assert not evaluate("<", "3", ["1", "9"])
    assert not evaluate(">", "3", [])
    assert not evaluate("<", "3", [])


def test_ordered_puts_the_numbers_first_and_numerically():
    assert ordered(["beta", "10", "alpha", "2"]) == ["2", "10", "alpha", "beta"]
    assert ordered(None) == []


def test_no_condition():
    assert no_condition(None)
    assert no_condition("   ")
    assert not no_condition("GATE")


# ── reads ────────────────────────────────────────────────────────────────────

def test_load_all_renders_every_row_and_skips_a_row_with_no_key(service, store):
    store.find_by_match.return_value = [
        _row("flag", "yes"), _row("count", None, 7), _row("empty"), _row(None, "orphan")]
    out = service.load_all(1)
    assert out == {"flag": ["yes"], "count": ["7"], "empty": []}


def test_find_renders_one_key_and_an_absent_key_is_empty(service, store):
    store.find_by_match_and_key.side_effect = \
        lambda m, k: [_row("count", None, 7)] if k == "count" else []
    assert service.find(1, "count") == ["7"]
    assert service.find(1, "gone") == []


def test_has_asks_whether_the_key_owns_any_row_at_all(service, store):
    store.find_by_match_and_key.side_effect = lambda m, k: [_row("count", None, 7)] \
        if k == "count" else []
    assert service.has(1, "count") is True
    assert service.has(1, "gone") is False


# ── writes ───────────────────────────────────────────────────────────────────

def test_a_blank_key_is_skipped_not_an_error(service, store):
    service.upsert(1, None, None, "v")
    service.upsert(1, None, "   ", "v")
    store.upsert.assert_not_called()
    store.log_change.assert_not_called()


def test_upsert_splits_the_value_and_carries_the_provenance(service, store):
    store.find_by_match_and_key.return_value = []
    service.upsert(1, None, "count", " 42 ", 3, 12, 9, 5)
    store.upsert.assert_called_once_with(1, "count", None, 42, 3, 12, 9, 5)


def test_every_write_leaves_exactly_one_audit_row(service, store):
    store.find_by_match_and_key.return_value = [_row("gate", "SHUT")]
    service.upsert(1, None, "gate", "OPEN", 3, 12, None, 5)
    store.log_change.assert_called_once()
    message = store.log_change.call_args[0][5]
    assert message.startswith(MSG_REGISTRY_CHANGE)
    assert "gate" in message and "SHUT" in message and "OPEN" in message


def test_seed_writes_one_row_per_key_holding_its_default(service, store):
    service.seed(9, [{"key_name": "n", "key_value": "42"},
                     {"key_name": "name", "key_value": "hi"},
                     {"key_name": "blank", "key_value": "  "},
                     {"key_name": "none", "key_value": None}])
    rows = store.insert_all.call_args[0][1]
    assert [r["int_value"] for r in rows] == [42, None, None, None]
    assert [r["string_value"] for r in rows] == [None, "hi", "", None]


def test_seed_accepts_the_legacy_field_names(service, store):
    service.seed(9, [{"name": "foo", "value": "bar"}])
    assert store.insert_all.call_args[0][1][0] == \
        {"key": "foo", "multi_value": 0, "string_value": "bar", "int_value": None}


def test_a_story_with_no_keys_still_seeds_an_empty_list(service, store):
    service.seed(9, None)
    store.insert_all.assert_called_once_with(9, [])


# ── Step 36.1 — multi-valued keys ───────────────────────────────────────────

def test_a_key_the_story_declares_multi_joins_instead_of_replacing(store):
    story_read = MagicMock()
    story_read.find_keys_by_story_id.return_value = [_definition("clues", multi_value=1)]
    service = RegistryService(store, story_read, MagicMock())
    store.find_by_match_and_key.return_value = []

    assert service.upsert(1, 9, "clues", "A", 3, 12, None, 6) == ["A"]

    store.insert_value.assert_called_once_with(1, "clues", "A", None, 3, 12, None, 6)
    store.upsert.assert_not_called()
    store.log_change.assert_called_once_with(1, 3, 12, None, 6,
                                             f"{MSG_REGISTRY_CHANGE} clues +A")


def test_the_rows_decide_not_the_story(store):
    """A running match keeps the behaviour it was born with."""
    story_read = MagicMock()
    story_read.find_keys_by_story_id.return_value = [_definition("clues", multi_value=0)]
    service = RegistryService(store, story_read, MagicMock())
    store.find_by_match_and_key.return_value = [_multi_row("clues", "A")]

    assert service.upsert(1, 9, "clues", "B") == ["A", "B"]
    store.insert_value.assert_called_once()


def test_adding_a_member_the_set_already_holds_writes_nothing(service, store):
    store.find_by_match_and_key.return_value = [_multi_row("clues", "A")]

    assert service.upsert(1, None, "clues", "A") == ["A"]
    assert service.upsert(1, None, "clues", None) == ["A"]

    store.insert_value.assert_not_called()
    store.log_change.assert_not_called()


def test_remove_on_a_blank_or_untouched_key_does_nothing(service, store):
    store.find_by_match_and_key.return_value = []
    assert service.remove(1, "  ", "A") == []
    assert service.remove(1, "clues", "A") == []
    store.delete_value.assert_not_called()
    store.upsert.assert_not_called()


def test_on_a_single_key_remove_is_still_compare_and_clear(service, store):
    store.find_by_match_and_key.return_value = [_row("door", "OPEN")]

    assert service.remove(1, "door", "OPEN", 3, 12, None, 6) == []

    store.upsert.assert_called_once_with(1, "door", None, None, 3, 12, None, 6)
    store.log_change.assert_called_once_with(1, 3, 12, None, 6,
                                             f"{MSG_REGISTRY_CHANGE} door OPEN -> None")


def test_a_single_key_the_story_moved_on_from_is_left_alone(service, store):
    store.find_by_match_and_key.return_value = [_row("door", "SHUT")]
    assert service.remove(1, "door", "OPEN") == ["SHUT"]
    assert service.remove(1, "door", None) == ["SHUT"]
    store.upsert.assert_not_called()


def test_on_a_multi_key_remove_takes_one_member_and_leaves_the_rest(service, store):
    store.find_by_match_and_key.return_value = [
        _multi_row("clues", "A"), _multi_row("clues", "B")]

    assert service.remove(1, "clues", "B", 3, None, 9, 4) == ["A"]

    store.delete_value.assert_called_once_with(1, "clues", "B", None)
    store.log_change.assert_called_once_with(1, 3, None, 9, 4,
                                             f"{MSG_REGISTRY_CHANGE} clues -B")


def test_removing_a_member_the_set_never_held_changes_nothing(service, store):
    store.find_by_match_and_key.return_value = [_multi_row("clues", "A")]
    assert service.remove(1, "clues", "Z") == ["A"]
    assert service.remove(1, "clues", None) == ["A"]
    store.delete_value.assert_not_called()


def test_seed_stamps_the_mirror_and_a_multi_key_with_no_default_seeds_no_row(service, store):
    service.seed(9, [{"key_name": "clues", "key_value": None, "multi_value": 1},
                     {"key_name": "found", "key_value": "A", "multi_value": 1},
                     {"key_name": "door", "key_value": "SHUT", "multi_value": 0}])

    rows = store.insert_all.call_args[0][1]
    assert [r["key"] for r in rows] == ["found", "door"]
    assert [r["multi_value"] for r in rows] == [1, 0]


def test_a_row_holding_no_value_at_all_is_not_a_member(service, store):
    rows = [_multi_row("clues", "A"), _multi_row("clues")]
    store.find_by_match.return_value = rows
    store.find_by_match_and_key.return_value = rows

    assert service.find(1, "clues") == ["A"]
    assert service.list_entries(1)[0]["values"] == ["A"]
    assert service.remove(1, "clues", "Z") == ["A"]


def test_entries_are_one_per_key_and_an_emptied_key_still_has_one(enriched, store):
    service, story_read, _ = enriched
    store.find_by_match.return_value = [_multi_row("clues", "B"), _multi_row("clues", "A")]
    story_read.find_keys_by_story_id.return_value = [
        _definition("clues", multi_value=1), _definition("gone", multi_value=1)]

    by_key = {e["key"]: e for e in service.list_entries(1, 9, include_hidden=True)}

    assert by_key["clues"]["values"] == ["A", "B"]
    assert by_key["clues"]["multi_value"] is True
    assert by_key["gone"]["values"] == []


def test_delete_hands_the_ids_straight_to_the_store(service, store):
    service.delete_by_match([1, 2])
    store.delete_by_match_ids.assert_called_once_with([1, 2])


# ── joined with the story definitions ────────────────────────────────────────

def _definition(name, group=None, priority=None, visibility="PUBLIC", id_card=None,
                multi_value=0):
    return {"key_name": name, "key_group": group, "priority": priority,
            "visibility": visibility, "id_card": id_card, "multi_value": multi_value}


@pytest.fixture
def enriched(store):
    story_read = MagicMock()
    content = MagicMock()
    return RegistryService(store, story_read, content), story_read, content


def test_entries_carry_category_priority_and_visibility(enriched, store):
    service, story_read, _ = enriched
    store.find_by_match.return_value = [_row("progress", None, 3)]
    story_read.find_keys_by_story_id.return_value = [_definition("progress", "tutorial", 2)]

    entry = service.list_entries(1, 9, include_hidden=False)[0]

    assert entry["category"] == "tutorial"
    assert entry["priority"] == 2
    assert entry["visible"] is True
    assert entry["values"] == ["3"]


def test_anything_but_public_is_hidden_and_dropped_by_default(enriched, store):
    service, story_read, _ = enriched
    store.find_by_match.return_value = [_row("shown", "a"), _row("secret", "b")]
    story_read.find_keys_by_story_id.return_value = [
        _definition("shown", "g", 1), _definition("secret", "g", 2, visibility="HIDDEN")]

    assert [e["key"] for e in service.list_entries(1, 9, include_hidden=False)] == ["shown"]
    assert len(service.list_entries(1, 9, include_hidden=True)) == 2


def test_a_key_the_story_no_longer_declares_is_kept_but_hidden(enriched, store):
    service, story_read, _ = enriched
    store.find_by_match.return_value = [_row("orphan", "x")]
    story_read.find_keys_by_story_id.return_value = []

    assert service.list_entries(1, 9, include_hidden=False) == []
    orphan = service.list_entries(1, 9, include_hidden=True)[0]
    assert orphan["visible"] is False


def test_ordered_by_category_then_priority_then_key(enriched, store):
    service, story_read, _ = enriched
    store.find_by_match.return_value = [_row("zeta"), _row("alpha"), _row("beta")]
    story_read.find_keys_by_story_id.return_value = [
        _definition("zeta", "tutorial", 2), _definition("alpha", "tutorial", 1),
        _definition("beta", "evidence", 1)]

    assert [e["key"] for e in service.list_entries(1, 9, include_hidden=False)] == \
        ["beta", "alpha", "zeta"]


def test_groups_bucket_the_entries_and_a_key_with_no_group_lands_under_none(enriched, store):
    service, story_read, _ = enriched
    store.find_by_match.return_value = [_row("a"), _row("b")]
    story_read.find_keys_by_story_id.return_value = [
        _definition("a", "tutorial", 1), _definition("b", None, 1)]

    groups = service.list_groups(1, 9)
    assert [g["category"] for g in groups] == [None, "tutorial"]


def test_the_card_is_resolved_only_when_the_key_declares_one(enriched, store):
    service, story_read, content = enriched
    store.find_by_match.return_value = [_row("a"), _row("b")]
    story_read.find_keys_by_story_id.return_value = [
        _definition("a", "g", 1, id_card=950), _definition("b", "g", 2)]

    service.list_entries(1, 9, include_hidden=False)

    content.get_card_by_story_id_and_card_id.assert_called_once_with(9, 950, "en")


def test_with_no_story_to_join_against_entries_still_come_back_bare(enriched, store):
    service, story_read, _ = enriched
    store.find_by_match.return_value = [_row("a")]
    assert len(service.list_entries(1, None, include_hidden=True)) == 1
    story_read.find_keys_by_story_id.assert_not_called()
