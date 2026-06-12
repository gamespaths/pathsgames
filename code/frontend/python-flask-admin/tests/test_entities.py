from app.entities import (ENTITY_TYPES, STORIES_ENTITIES_COLUMNS,
                          STORIES_ENTITIES_FIELDS, STORIES_ENTITIES_TABS)


def test_entity_types_count():
    # 23 tabs minus the metadata tab = 22 real sub-entities
    assert len(ENTITY_TYPES) == 22
    assert "metadata" not in ENTITY_TYPES


def test_every_entity_has_fields_and_columns():
    for et in ENTITY_TYPES:
        assert et in STORIES_ENTITIES_FIELDS, f"missing FIELDS for {et}"
        assert et in STORIES_ENTITIES_COLUMNS, f"missing COLUMNS for {et}"
        assert STORIES_ENTITIES_FIELDS[et], f"empty fields for {et}"


def test_fields_have_required_keys():
    for et, fields in STORIES_ENTITIES_FIELDS.items():
        for f in fields:
            assert "key" in f and "label" in f and "type" in f
            if f["type"] == "select":
                assert f.get("options"), f"select {et}.{f['key']} needs options"
                assert all("value" in o and "label" in o for o in f["options"])


def test_tabs_unique_ids():
    ids = [t["id"] for t in STORIES_ENTITIES_TABS]
    assert len(ids) == len(set(ids))
