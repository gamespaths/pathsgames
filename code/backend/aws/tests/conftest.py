"""
Shared test fixtures and sys.path setup for AWS Lambda unit tests.
All Lambda handlers use `from common import db_utils` — we need `lambda/`
on the path so those imports resolve without a SAM build.
"""
import sys
import os
import pytest

# Make the lambda/ directory importable as a package root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambda'))
# Make the tests/ directory importable so helpers.py is reachable
sys.path.insert(0, os.path.dirname(__file__))


@pytest.fixture(autouse=True)
def _row_sink(monkeypatch):
    """v0.37.5 — log rows go to an in-memory sink unless a suite patches the table itself."""
    import helpers
    from common import db_utils
    helpers.SINK.rows.clear()
    helpers.REAL_BATCH_PUT = db_utils.batch_put_items
    monkeypatch.setattr(db_utils, 'batch_put_items', helpers.SINK.batch_put_items)


@pytest.fixture(autouse=True)
def _no_story_cache(monkeypatch):
    """v0.37.5 — every test sees the story it patches: cache off, memory cleared."""
    from common import story_cache
    monkeypatch.setattr(story_cache, 'TTL', 0)
    story_cache.clear()
    yield
    story_cache.clear()


@pytest.fixture
def ctx():
    """Dummy Lambda context (unused by all handlers)."""
    return {}
