from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Index, func, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, relationship
from datetime import datetime, timezone


class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=False)
    nickname = Column(String(100))
    state = Column(Integer, default=1)  # 6 for guest
    role = Column(String(20), default='PLAYER')
    guest_cookie_token = Column(String(36), index=True)
    guest_expires_at = Column(String(50))
    language = Column(String(10), default='en')
    # v1.7.0 — the profile theme (Java users.theme_selected): default or high-contrast.
    theme_selected = Column(String(50), default='default')
    ts_registration = Column(String(50))
    last_access = Column(String(50))
    # v0.41.4 — decision 56: the e-mail a match import copies and matches users by (Java email_address).
    email_address = Column(String(255))
    # v1.7.0 step 10 — ISO-8601 end of a suspension (state 3) and the one-time re-link flag of a mismatch
    suspended_until = Column(String(50))
    relink_pending = Column(Integer, nullable=False, default=0, server_default="0")
    # v1.7.0 step 12 — ISO-8601 second: access tokens issued before it answer 401 SESSION_REVOKED
    sessions_valid_after = Column(String(50))
    
    tokens = relationship("UserToken", back_populates="user", cascade="all, delete-orphan")

    # v0.41.0 — the guest cleanup selects by state and last access (Java V0.41.0 migration)
    # v1.2.0 — unique nickname and (when present) unique email, as the Java V1.2.0 migration
    __table_args__ = (Index("idx_users_state_last_access", "state", "last_access"),
                      Index("uq_users_email", "email_address", unique=True,
                            sqlite_where=text("email_address IS NOT NULL"),
                            postgresql_where=text("email_address IS NOT NULL")),
                      Index("uq_users_nickname", "nickname", unique=True))

class UserToken(Base):
    __tablename__ = 'users_tokens'
    
    id = Column(Integer, primary_key=True)
    id_user = Column(Integer, ForeignKey('users.id'), nullable=False)
    refresh_token = Column(String(500), nullable=False)
    jti = Column(String(255), index=True)
    revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(String(50), nullable=False)
    ts_insert = Column(DateTime, server_default=func.now())
    # v1.2.0 set when a refresh rotated the token: starts the grace window
    ts_rotated = Column(String(50))
    # v1.7.0 step 12 — ROTATED, LOGOUT, LOGOUT_ALL, LIMIT or ADMIN and the revocation time (7-day purge)
    revoked_reason = Column(String(20))
    ts_update = Column(String(50))
    
    user = relationship("User", back_populates="tokens")


class UserIdentity(Base):
    """v1.2.0 one login provider of a user (Java users_identities); the email is the key, never updated."""
    __tablename__ = 'users_identities'

    id = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    id_user = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    provider = Column(String(20), nullable=False)
    provider_subject = Column(String(255), nullable=False)
    email = Column(String(255))
    profile_name = Column(String(255))
    given_name = Column(String(255))
    family_name = Column(String(255))
    picture_url = Column(String(1000))
    locale = Column(String(20))
    ts_profile_update = Column(String(50))
    ts_insert = Column(String(50))
    ts_update = Column(String(50))

    __table_args__ = (Index("uq_users_identities_provider_email", "provider", "email", unique=True),
                      Index("idx_users_identities_subject", "provider", "provider_subject"),
                      Index("idx_users_identities_user", "id_user"))


class UserBannedSubject(Base):
    """v1.7.0 one row per banned user: HMAC-SHA256 with the stage pepper of the Google subject and email."""
    __tablename__ = 'users_banned_subjects'

    uuid = Column(String(36), primary_key=True)
    hash_sub = Column(String(64))
    hash_email = Column(String(64))
    ts_insert = Column(String(50))

    __table_args__ = (Index("uq_users_banned_subjects_sub", "hash_sub", unique=True),
                      Index("uq_users_banned_subjects_email", "hash_email", unique=True))


class AdminInterventionLog(Base):
    """v1.7.0 who did what to whom and why (never nickname or email); SYSTEM = automatic action."""
    __tablename__ = 'admin_intervention_log'

    id = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    ts_insert = Column(String(50), nullable=False, index=True)
    admin_uuid = Column(String(36), nullable=False)
    action = Column(String(30), nullable=False)
    target_uuid = Column(String(36), nullable=False, index=True)
    reason = Column(String(500), nullable=False)


class AuthIdTokenSeen(Base):
    """v1.2.0 hash of every Google ID token used, kept until its exp, to refuse a replay."""
    __tablename__ = 'auth_id_token_seen'

    token_hash = Column(String(64), primary_key=True)
    expires_at = Column(String(50), nullable=False, index=True)
    ts_insert = Column(String(50))
