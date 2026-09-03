from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from app.adapters.persistence.auth.models import Base
from app.config import settings
import os

def get_engine():
    if settings.env == "development":
        db_url = f"sqlite:///./{settings.db_path}"
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
    else:
        db_url = f"postgresql://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
        engine = create_engine(db_url)
    return engine

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# v0.35.8 — the Python side has no Flyway: `create_all` creates missing TABLES and
# never touches an existing one, so a model whose columns changed leaves the database
# behind for ever ("column ... does not exist" on the next insert). These are the known
# drifts, replayed at every startup and each one a no-op once applied.
#
#   list_locations_neighbors: the columns were named condition_key/_value, while the
#   Java schema (V0.10.3) calls them condition_registry_key/_value, and id_text_go /
#   id_text_back — the label of the edge in each direction — were missing entirely.
#   list_weather_rules: the columns were named condition_value / time_start / time_end /
#   is_active, none of which exist in the Java schema, and id_text — the rule's own label —
#   was missing altogether.
_RENAMED_COLUMNS = {
    "list_locations_neighbors": [
        ("condition_key", "condition_registry_key"),
        ("condition_value", "condition_registry_value"),
    ],
    "list_weather_rules": [
        ("condition_value", "condition_key_value"),
        ("time_start", "time_from"),
        ("time_end", "time_to"),
        ("is_active", "active"),
    ],
}
_ADDED_COLUMNS = {
    "list_locations_neighbors": ["id_text_go", "id_text_back",
                                 "registry_value_operator_condition"],
    "list_weather_rules": ["id_text", "registry_value_operator_condition"],
    # Step 36 — the operator on events, and the ordering column list_keys never had.
    "list_events": ["registry_value_operator_condition"],
    "list_keys": ["priority"],
}
# Added columns are integers unless named here: the Step 36 operator holds "=", ">", "<", "!=".
_TEXT_COLUMNS = {"registry_value_operator_condition"}


def align_schema(bind=None):
    """Bring an existing database in line with the models. Idempotent: it inspects the
    live columns and only issues what is actually missing."""
    bind = bind or engine
    inspector = inspect(bind)
    int_type = "BIGINT" if bind.dialect.name == "postgresql" else "INTEGER"
    statements = []
    for table, renames in _RENAMED_COLUMNS.items():
        if not inspector.has_table(table):
            continue
        columns = {c["name"] for c in inspector.get_columns(table)}
        for old, new in renames:
            if old in columns and new not in columns:
                statements.append(f"ALTER TABLE {table} RENAME COLUMN {old} TO {new}")
    for table, additions in _ADDED_COLUMNS.items():
        if not inspector.has_table(table):
            continue
        columns = {c["name"] for c in inspector.get_columns(table)}
        for column in additions:
            if column not in columns:
                column_type = "TEXT" if column in _TEXT_COLUMNS else int_type
                statements.append(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
    if not statements:
        return []
    with bind.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
    return statements


def init_db():
    Base.metadata.create_all(bind=engine)
    align_schema(engine)
    #if settings.env == "development":
    #    from app.adapters.persistence.seed_dev_data import seed_dev_data
    #    seed_dev_data(engine)
