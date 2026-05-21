"""Tests for the match_statuses helper module."""
from app.core.models.match import match_statuses


def test_all_lists_the_five_lifecycle_statuses():
    assert match_statuses.ALL == ["CREATED", "RUNNING", "PAUSED", "ENDED", "GAMEOVER"]


def test_is_valid():
    assert match_statuses.is_valid("ENDED")
    assert match_statuses.is_valid("CREATED")
    assert not match_statuses.is_valid("BOGUS")
    assert not match_statuses.is_valid(None)


def test_is_terminal():
    assert match_statuses.is_terminal("ENDED")
    assert match_statuses.is_terminal("GAMEOVER")
    assert not match_statuses.is_terminal("RUNNING")
    assert not match_statuses.is_terminal(None)
