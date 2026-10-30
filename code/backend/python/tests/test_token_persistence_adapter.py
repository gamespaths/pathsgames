"""TokenPersistenceAdapter on SQLite: v1.2.0 lookup by hash with the lazy rewrite of a clear token,
rotation, revoke, the session cap and the user lookups."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.adapters.persistence.match.models  # noqa: F401  - registers the tables the users FK needs
import app.adapters.persistence.story.models  # noqa: F401
from app.adapters.persistence.auth.models import Base, User, UserToken
from app.adapters.persistence.auth.token_persistence_adapter import TokenPersistenceAdapter


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


@pytest.fixture
def adapter(session_factory):
    return TokenPersistenceAdapter(session_factory)


@pytest.fixture
def user_id(session_factory):
    with session_factory() as session:
        user = User(uuid="test-user-uuid", username="testuser", nickname="testuser", state=2, role="PLAYER")
        session.add(user)
        session.commit()
        return user.id


def _token(session_factory, user_id, value, revoked=False):
    with session_factory() as session:
        t = UserToken(id_user=user_id, refresh_token=value, revoked=revoked, expires_at="2999-01-01T00:00:00+00:00")
        session.add(t)
        session.commit()
        return t.id


def test_find_user_id_by_uuid(adapter, user_id):
    assert adapter.find_user_id_by_uuid("test-user-uuid") == user_id
    assert adapter.find_user_id_by_uuid("missing") is None


def test_store_and_find_by_hash(adapter, user_id):
    adapter.store_refresh_token(user_id, "hash-1", "2999-01-01T00:00:00+00:00")
    found = adapter.find_refresh_token("hash-1", None)
    assert found.user_id == user_id and found.revoked is False and found.ts_rotated is None
    assert adapter.find_refresh_token(None, "x") is None
    assert adapter.find_refresh_token("missing", None) is None


def test_legacy_clear_token_is_rewritten_as_hash(adapter, user_id, session_factory):
    _token(session_factory, user_id, "clear-token")
    assert adapter.find_refresh_token("hash-2", "clear-token") is not None
    with session_factory() as session:
        assert session.query(UserToken).filter(UserToken.refresh_token == "hash-2").count() == 1


def test_rotation_and_revoke(adapter, user_id, session_factory):
    token_id = _token(session_factory, user_id, "h")
    adapter.mark_rotated(token_id, "2026-10-19T00:00:00+00:00")
    found = adapter.find_refresh_token("h", None)
    assert found.revoked is True and found.ts_rotated == "2026-10-19T00:00:00+00:00"
    assert adapter.revoke_refresh_token("h", None) is False
    _token(session_factory, user_id, "h2")
    assert adapter.revoke_refresh_token("h2", None) is True
    assert adapter.revoke_refresh_token("missing", None) is False


def test_revoke_all(adapter, user_id, session_factory):
    _token(session_factory, user_id, "a")
    _token(session_factory, user_id, "b")
    adapter.revoke_all_by_user_uuid("test-user-uuid")
    adapter.revoke_all_by_user_uuid("missing")
    with session_factory() as session:
        assert session.query(UserToken).filter(UserToken.revoked == False).count() == 0  # noqa: E712


def test_enforce_token_limit_revokes_the_oldest(adapter, user_id, session_factory):
    ids = [_token(session_factory, user_id, f"t{i}") for i in range(4)]
    adapter.enforce_token_limit(user_id, 2)
    with session_factory() as session:
        revoked = {t.id for t in session.query(UserToken).filter(UserToken.revoked == True).all()}  # noqa: E712
    assert revoked == set(ids[:2])
    adapter.enforce_token_limit(user_id, 5)


def test_user_lookup_and_last_access(adapter, user_id, session_factory):
    status = adapter.find_user_by_id(user_id)
    assert status.uuid == "test-user-uuid" and status.state == 2 and status.role == "PLAYER"
    assert adapter.find_user_by_id(999) is None
    adapter.update_last_access(user_id)
    with session_factory() as session:
        assert session.query(User).get(user_id).last_access is not None
