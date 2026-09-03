"""Step 36 — the one place that reads, writes and compares the match registry."""
from unittest.mock import MagicMock

import pytest

from app.core.services.match.registry_service import (
    MSG_REGISTRY_CHANGE, RegistryService, evaluate, no_condition, parse, render, render_row,
)


def _row(key, string_value=None, int_value=None, id_character=None):
    return {"id": 1, "uuid": f"u-{key}", "key": key, "string_value": string_value,
            "int_value": int_value, "id_character": id_character, "id_event": None,
            "id_choice": None, "clock": None}


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
    assert evaluate("=", "OPEN", "OPEN")
    assert not evaluate("=", "OPEN", "SHUT")
    assert evaluate("!=", "OPEN", "SHUT")
    assert not evaluate("!=", "OPEN", "OPEN")


def test_ordering_needs_both_sides_numeric():
    assert evaluate(">", "3", "4")
    assert not evaluate(">", "3", "3")
    assert evaluate("<", "3", "2")
    assert not evaluate(">", "3", "many")
    assert not evaluate("<", "lots", "2")


def test_an_absent_key_satisfies_only_not_equals():
    assert evaluate("!=", "OPEN", None)
    assert not evaluate("=", "OPEN", None)
    assert not evaluate(">", "1", None)


def test_a_null_expected_value_is_never_met():
    """A typo must lock a door, never open one."""
    assert not evaluate("=", None, "OPEN")
    assert not evaluate("!=", None, "OPEN")
    assert not evaluate("=", None, None)


def test_operator_defaults_to_equals_and_an_unknown_one_never_matches():
    assert evaluate(None, "OPEN", "OPEN")
    assert evaluate("   ", "OPEN", "OPEN")
    assert evaluate(" = ", "OPEN", "OPEN")
    assert not evaluate("~=", "OPEN", "OPEN")


def test_no_condition():
    assert no_condition(None)
    assert no_condition("   ")
    assert not no_condition("GATE")


# ── reads ────────────────────────────────────────────────────────────────────

def test_load_all_renders_every_row_and_skips_a_row_with_no_key(service, store):
    store.find_by_match.return_value = [
        _row("flag", "yes"), _row("count", None, 7), _row("empty"), _row(None, "orphan")]
    out = service.load_all(1)
    assert out == {"flag": "yes", "count": "7", "empty": None}


def test_find_renders_one_key_and_an_absent_key_is_none(service, store):
    store.find_by_match_and_key.side_effect = \
        lambda m, k: _row("count", None, 7) if k == "count" else None
    assert service.find(1, "count") == "7"
    assert service.find(1, "gone") is None


# ── writes ───────────────────────────────────────────────────────────────────

def test_a_blank_key_is_skipped_not_an_error(service, store):
    service.upsert(1, None, "v")
    service.upsert(1, "   ", "v")
    store.upsert.assert_not_called()
    store.log_change.assert_not_called()


def test_upsert_splits_the_value_and_carries_the_provenance(service, store):
    store.find_by_match_and_key.return_value = None
    service.upsert(1, "count", " 42 ", 3, 12, 9, 5)
    store.upsert.assert_called_once_with(1, "count", None, 42, 3, 12, 9, 5)


def test_every_write_leaves_exactly_one_audit_row(service, store):
    store.find_by_match_and_key.return_value = _row("gate", "SHUT")
    service.upsert(1, "gate", "OPEN", 3, 12, None, 5)
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
        {"key": "foo", "string_value": "bar", "int_value": None}


def test_a_story_with_no_keys_still_seeds_an_empty_list(service, store):
    service.seed(9, None)
    store.insert_all.assert_called_once_with(9, [])


def test_delete_hands_the_ids_straight_to_the_store(service, store):
    service.delete_by_match([1, 2])
    store.delete_by_match_ids.assert_called_once_with([1, 2])


# ── joined with the story definitions ────────────────────────────────────────

def _definition(name, group=None, priority=None, visibility="PUBLIC", id_card=None):
    return {"key_name": name, "key_group": group, "priority": priority,
            "visibility": visibility, "id_card": id_card}


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
    assert entry["int_value"] == 3


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
