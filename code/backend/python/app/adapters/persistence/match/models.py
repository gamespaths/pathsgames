"""SQLAlchemy ORM models for the gaming runtime tables introduced in Step 19.

Schema is intentionally aligned with the Java Flyway migrations
``V0.10.6__create_gaming_core.sql`` and ``V0.10.7__create_gaming_state.sql``.
"""
from sqlalchemy import Column, ForeignKey, Integer, String

from app.adapters.persistence.auth.models import Base


class GamingMatchEntity(Base):
    __tablename__ = "gaming_match"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False)
    id_story = Column(Integer, ForeignKey("list_stories.id"), nullable=False)
    id_difficulty = Column(Integer, nullable=False)
    name = Column(String(255))
    exp_cost = Column(Integer, default=5, nullable=False)
    status = Column(String(20), default="CREATED", nullable=False)
    current_clock = Column(Integer, default=0, nullable=False)
    id_current_weather = Column(Integer)
    id_user_creator = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp_start = Column(String(50))
    timestamp_lock_expiration = Column(String(50))
    timestamp_gameover = Column(String(50))
    timestamp_end = Column(String(50))
    id_character_current_turn = Column(Integer)
    secure_location_param = Column(Integer, default=0)
    counter_consecutive_pass = Column(Integer, default=0, nullable=False)
    # Step 0.19.9 — creator loadout chosen at match creation.
    single_player = Column(Integer, default=1, nullable=False)
    character_template_uuid = Column(String(36))
    class_uuid = Column(String(36))
    trait_uuids = Column(String(512))
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class GamingStateLocationEntity(Base):
    __tablename__ = "gaming_state_locations"

    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    id_location = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    flag_already_actived = Column(Integer, default=0, nullable=False)
    clock_counter = Column(Integer, default=0)
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class GamingStateRegistryEntity(Base):
    __tablename__ = "gaming_state_registry"

    id = Column(Integer, primary_key=True)
    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    key = Column(String(255), nullable=False)
    string_value = Column(String(2000))
    int_value = Column(Integer)
    id_character = Column(Integer)
    id_event = Column(Integer)
    id_choice = Column(Integer)
    clock = Column(Integer)
    id_mission = Column(Integer)
    id_mission_steps = Column(Integer)
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)
