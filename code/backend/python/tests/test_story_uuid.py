"""Tests for the story uuid helper (v0.41.5)."""
from app.core.models.story.story_uuid import is_valid_story_uuid, normalize_story_uuid


def test_normalize_trims_and_lowercases():
    assert normalize_story_uuid(" 0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D ") == "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
    assert normalize_story_uuid(123) == "123"


def test_normalize_maps_absent_and_blank_to_none():
    assert normalize_story_uuid(None) is None
    assert normalize_story_uuid("") is None
    assert normalize_story_uuid("   ") is None


def test_is_valid_checks_the_lowercase_shape():
    assert is_valid_story_uuid("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")
    assert not is_valid_story_uuid("0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D")
    assert not is_valid_story_uuid("0a1b2c3d4e5f4a6b8c7d9e0f1a2b3c4d")
    assert not is_valid_story_uuid("story-001")
    assert not is_valid_story_uuid(None)
