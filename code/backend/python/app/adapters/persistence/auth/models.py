from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, func
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
    ts_registration = Column(String(50))
    last_access = Column(String(50))
    
    tokens = relationship("UserToken", back_populates="user", cascade="all, delete-orphan")

class UserToken(Base):
    __tablename__ = 'users_tokens'
    
    id = Column(Integer, primary_key=True)
    id_user = Column(Integer, ForeignKey('users.id'), nullable=False)
    refresh_token = Column(String(500), nullable=False)
    jti = Column(String(255), index=True)
    revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(String(50), nullable=False)
    ts_insert = Column(DateTime, server_default=func.now())
    
    user = relationship("User", back_populates="tokens")
