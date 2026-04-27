import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.adapters.persistence.auth.models import Base, User, UserToken
from app.adapters.persistence.auth.token_persistence_adapter import TokenPersistenceAdapter
from app.core.models.auth.token_info import TokenInfo

@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)

@pytest.fixture
def adapter(session_factory):
    return TokenPersistenceAdapter(session_factory)

@pytest.fixture
def setup_user(session_factory):
    with session_factory() as session:
        user = User(
            uuid="test-user-uuid",
            username="testuser",
            state=6,
            guest_cookie_token="cookie",
            guest_expires_at="2025-01-01T00:00:00"
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

def test_find_user_id_by_uuid(adapter, setup_user):
    assert adapter.find_user_id_by_uuid("test-user-uuid") == setup_user.id
    assert adapter.find_user_id_by_uuid("missing") is None

def test_save_refresh_token(adapter, setup_user, session_factory):
    exp = (datetime.now(timezone.utc) + timedelta(days=1)).timestamp()
    info = TokenInfo(sub="test-user-uuid", iss="iss", aud="aud", exp=int(exp), nbf=0, iat=0, jti="jti123", roles=[], username="u", type="refresh")
    adapter.save_refresh_token("test-user-uuid", "refresh_tok", info)
    
    with session_factory() as session:
        token = session.query(UserToken).filter_by(refresh_token="refresh_tok").first()
        assert token is not None
        assert token.jti == "jti123"
        assert not token.revoked

    # Invalid user
    with pytest.raises(ValueError):
        adapter.save_refresh_token("invalid", "tok", info)

def test_revoke_token(adapter, setup_user, session_factory):
    exp = (datetime.now(timezone.utc) + timedelta(days=1)).timestamp()
    info = TokenInfo(sub="test-user-uuid", iss="iss", aud="aud", exp=int(exp), nbf=0, iat=0, jti="jti1", roles=[], username="u", type="refresh")
    adapter.save_refresh_token("test-user-uuid", "refresh_tok", info)
    
    adapter.revoke_token("refresh_tok")
    
    with session_factory() as session:
        token = session.query(UserToken).filter_by(refresh_token="refresh_tok").first()
        assert token.revoked

def test_revoke_all_by_user_uuid(adapter, setup_user, session_factory):
    exp = (datetime.now(timezone.utc) + timedelta(days=1)).timestamp()
    info = TokenInfo(sub="test-user-uuid", iss="iss", aud="aud", exp=int(exp), nbf=0, iat=0, jti="jti", roles=[], username="u", type="refresh")
    adapter.save_refresh_token("test-user-uuid", "tok1", info)
    adapter.save_refresh_token("test-user-uuid", "tok2", info)
    
    adapter.revoke_all_by_user_uuid("test-user-uuid")
    
    with session_factory() as session:
        tokens = session.query(UserToken).filter_by(id_user=setup_user.id).all()
        for t in tokens:
            assert t.revoked

    # Should not raise
    adapter.revoke_all_by_user_uuid("missing")

def test_is_refresh_token_valid(adapter, setup_user):
    now = datetime.now(timezone.utc)
    future = (now + timedelta(days=1)).timestamp()
    past = (now - timedelta(days=1)).timestamp()
    
    info_future = TokenInfo(sub="u", iss="i", aud="a", exp=int(future), nbf=0, iat=0, jti="j1", roles=[], username="u", type="refresh")
    info_past = TokenInfo(sub="u", iss="i", aud="a", exp=int(past), nbf=0, iat=0, jti="j2", roles=[], username="u", type="refresh")
    
    adapter.save_refresh_token("test-user-uuid", "valid_tok", info_future)
    adapter.save_refresh_token("test-user-uuid", "expired_tok", info_past)
    
    assert adapter.is_refresh_token_valid("valid_tok") is True
    assert adapter.is_refresh_token_valid("expired_tok") is False
    assert adapter.is_refresh_token_valid("missing") is False
    
    adapter.revoke_token("valid_tok")
    assert adapter.is_refresh_token_valid("valid_tok") is False

def test_enforce_token_limit(adapter, setup_user, session_factory):
    exp = (datetime.now(timezone.utc) + timedelta(days=1)).timestamp()
    info = TokenInfo(sub="u", iss="i", aud="a", exp=int(exp), nbf=0, iat=0, jti="j", roles=[], username="u", type="refresh")
    
    for i in range(5):
        adapter.save_refresh_token("test-user-uuid", f"tok{i}", info)
        
    adapter.enforce_token_limit(setup_user.id, 3)
    
    with session_factory() as session:
        tokens = session.query(UserToken).filter_by(id_user=setup_user.id).order_by(UserToken.id.asc()).all()
        # The oldest 2 should be revoked
        assert tokens[0].revoked
        assert tokens[1].revoked
        assert not tokens[2].revoked
        assert not tokens[3].revoked
        assert not tokens[4].revoked
