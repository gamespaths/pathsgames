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
def _no_real_dynamodb(monkeypatch):
    """v0.37.5 — a db_utils call nobody patched must fail the same way with or without AWS
    credentials (CI has none): answer it with a ClientError the helpers already catch."""
    from botocore.exceptions import ClientError
    from common import db_utils

    class _Offline:
        def __getattr__(self, name):
            def _raise(*_a, **_k):
                raise ClientError({'Error': {'Code': 'OfflineUnitTest',
                                             'Message': f'table.{name} reached DynamoDB'}}, name)
            return _raise

    real_get_table = db_utils._get_table

    def guarded():
        if db_utils._table is not None:
            return db_utils._table
        if db_utils.__dict__.get('_OFFLINE_BYPASS'):
            return real_get_table()
        return _Offline()

    monkeypatch.setattr(db_utils, '_get_table', guarded)


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


@pytest.fixture(autouse=True)
def _csrf_off_by_default(monkeypatch):
    """v0.37.7 — Step 41 enforces X-CSRF-TOKEN on POST /api/matches. The suites written before
    it create matches bare, so the check is off here; test_security_utils turns it on itself."""
    monkeypatch.setenv('CSRF_ENFORCED', 'false')
    monkeypatch.delenv('RATE_LIMIT_GUEST_PER_IP', raising=False)
    monkeypatch.delenv('RATE_LIMIT_MATCH_PER_IP', raising=False)
