import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta
from app.adapters.persistence.auth.guest_persistence_adapter import GuestPersistenceAdapter
from app.adapters.persistence.auth.models import Base, User

@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)

@pytest.fixture
def adapter(session_factory):
    return GuestPersistenceAdapter(session_factory)

def test_create_guest_user(adapter):
    user_id = adapter.create_guest_user("u1", "guest1", "token1", "2025-01-01T00:00:00Z")
    assert user_id > 0
    
    guest = adapter.find_guest_by_uuid("u1")
    assert guest is not None
    assert guest["username"] == "guest1"
    assert guest["guest_cookie_token"] == "token1"

def test_find_guest_by_cookie_token(adapter):
    adapter.create_guest_user("u1", "guest1", "token1", "2025-01-01T00:00:00Z")
    
    guest = adapter.find_guest_by_cookie_token("token1")
    assert guest is not None
    assert guest["uuid"] == "u1"
    
    assert adapter.find_guest_by_cookie_token("wrong") is None

def test_delete_expired_guests(adapter):
    now = datetime.now(timezone.utc)
    past = (now - timedelta(days=1)).isoformat()
    future = (now + timedelta(days=1)).isoformat()
    
    adapter.create_guest_user("u1", "old", "t1", past)
    adapter.create_guest_user("u2", "new", "t2", future)
    
    deleted = adapter.delete_expired_guests()
    assert deleted == 1
    
    assert adapter.find_guest_by_uuid("u1") is None
    assert adapter.find_guest_by_uuid("u2") is not None

def test_counts(adapter):
    now = datetime.now(timezone.utc)
    past = (now - timedelta(days=1)).isoformat()
    future = (now + timedelta(days=1)).isoformat()
    
    adapter.create_guest_user("u1", "old", "t1", past)
    adapter.create_guest_user("u2", "new", "t2", future)
    
    assert adapter.count_all_guests() == 2
    assert adapter.count_active_guests() == 1
    assert adapter.count_expired_guests() == 1

def test_delete_guest_by_uuid(adapter):
    adapter.create_guest_user("u1", "g1", "t1", "2025")
    assert adapter.delete_guest_by_uuid("u1") is True
    assert adapter.delete_guest_by_uuid("missing") is False
