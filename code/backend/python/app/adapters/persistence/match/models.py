"""SQLAlchemy ORM models for the gaming runtime tables introduced in Step 19.

Schema is intentionally aligned with the Java Flyway migrations
``V0.10.6__create_gaming_core.sql`` and ``V0.10.7__create_gaming_state.sql``.
"""
from sqlalchemy import BigInteger, Column, ForeignKey, Integer, String

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
    # Step 27 — per-match deterministic RNG seed (weather/probability rolls).
    rng_seed = Column(BigInteger)
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


class GamingCharacterInstanceEntity(Base):
    """Step 21 — a character materialised in a match (one per user per match)."""

    __tablename__ = "gaming_character_instance"

    id = Column(Integer, primary_key=True)
    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    id_user = Column(Integer, ForeignKey("users.id"), nullable=False)
    id_character_template = Column(Integer, nullable=False)
    # Step 26 — selected class id; resolves list_classes_bonus at time-start recovery.
    id_class = Column(Integer)
    dexterity = Column(Integer, default=1, nullable=False)
    intelligence = Column(Integer, default=1, nullable=False)
    constitution = Column(Integer, default=1, nullable=False)
    energy = Column(Integer, default=0, nullable=False)
    life = Column(Integer, default=1, nullable=False)
    sad = Column(Integer, default=0, nullable=False)
    # Step 27 — max statistics computed at join and persisted on the instance.
    life_max = Column(Integer, default=0, nullable=False)
    energy_max = Column(Integer, default=0, nullable=False)
    sad_max = Column(Integer, default=0, nullable=False)
    weight_max = Column(Integer, default=0, nullable=False)
    id_location = Column(Integer)
    is_sleeping = Column(Integer, default=0, nullable=False)
    is_coma = Column(Integer, default=0, nullable=False)
    clock_in_coma = Column(Integer, default=0)
    timestamp_last_pass = Column(String(50))
    counter_consecutive_pass = Column(Integer, default=0, nullable=False)
    # Step 29 — two effect targets that previously had nowhere to be written.
    # exp is written by event effects here and spent in Step 37; characteristics is a CSV.
    exp = Column(Integer, default=0, nullable=False)
    characteristics = Column(String(500))
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class GamingBackpackResourcesEntity(Base):
    """Step 21 — backpack resources seeded for a character instance."""

    __tablename__ = "gaming_backpack_resources"

    id = Column(Integer, primary_key=True)
    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    id_character_match = Column(Integer, nullable=False)
    food = Column(Integer, default=0, nullable=False)
    magic = Column(Integer, default=0, nullable=False)
    coin = Column(Integer, default=0, nullable=False)
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class GamingInventoryItemsEntity(Base):
    """Step 27 — the items a character carries inside a match."""

    __tablename__ = "gaming_inventory_items"

    id = Column(Integer, primary_key=True)
    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    id_character_match = Column(Integer, nullable=False)
    id_item = Column(Integer, nullable=False)
    amount = Column(Integer, default=1, nullable=False)
    state = Column(String(20), default="ACTIVE")
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class GamingCharacterTraitsEntity(Base):
    """Step 21 — the traits selected for a character instance."""

    __tablename__ = "gaming_character_traits"

    id = Column(Integer, primary_key=True)
    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    id_character_match = Column(Integer, nullable=False)
    id_traits = Column(Integer, nullable=False)
    id_event = Column(Integer)
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class GamingTurnQueueEntity(Base):
    """Step 24 — single-player turn queue. One row per character of a match.
    ``status`` carries the explicit turn lifecycle WAITING -> ACTIVE -> COMPLETED."""

    __tablename__ = "gaming_turn_queue"

    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    id_character_match = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    clock = Column(Integer, nullable=False)
    timestamp_start = Column(String(50))
    timestamp_end = Column(String(50))
    pass_counter = Column(Integer, default=0, nullable=False)
    priority = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="WAITING", nullable=False)
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class LogClockHistoryEntity(Base):
    """Step 25 — append-only log of clock advances. One row per time-end.

    ``id`` is part of the composite PK ``(id, id_match)`` and globally unique; it
    is assigned explicitly by the adapter (SQLite does not auto-increment it)."""

    __tablename__ = "log_clock_history"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    clock = Column(Integer, nullable=False)
    weather = Column(String(100))
    timestamp_start = Column(String(50))
    timestamp_end = Column(String(50))
    id_event_start = Column(Integer)
    id_event_end = Column(Integer)
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class LogEventsEntity(Base):
    """Step 26 — append-only log of recovery summaries and counter-zero events.

    ``id`` is part of the composite PK ``(id, id_match)`` and globally unique; it
    is assigned explicitly by the adapter (SQLite does not auto-increment it)."""

    __tablename__ = "log_events"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    id_character_match = Column(Integer)
    timestamp = Column(String(50))
    id_event = Column(Integer)
    id_choise = Column(Integer)
    log_message = Column(String(2000))
    # Step 28.7 — clock at time of event; None for pre-28.7 rows.
    clock = Column(Integer)
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class LogWeatherEntity(Base):
    """Step 27 — append-only log of weather selections. One row per time-start.

    ``id`` is part of the composite PK ``(id, id_match)`` and globally unique; it
    is assigned explicitly by the adapter (SQLite does not auto-increment it)."""

    __tablename__ = "log_weather"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    clock = Column(Integer, nullable=False)
    id_weather = Column(Integer)
    timestamp_start = Column(String(50))
    timestamp_end = Column(String(50))
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)


class LogMovementEntity(Base):
    """Step 28 — append-only log of character movements. One row per successful move.

    ``id`` is part of the composite PK ``(id, id_match)`` and globally unique; it
    is assigned explicitly by the adapter (SQLite does not auto-increment it)."""

    __tablename__ = "log_movements"

    id = Column(Integer, primary_key=True, autoincrement=False)
    id_match = Column(Integer, ForeignKey("gaming_match.id"), primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    id_character_match = Column(Integer, nullable=False)
    id_location_from = Column(Integer)
    id_location_to = Column(Integer, nullable=False)
    energy_cost = Column(Integer, default=0, nullable=False)
    timestamp_start = Column(String(50))
    ts_insert = Column(String(50), nullable=False)
    ts_update = Column(String(50), nullable=False)
