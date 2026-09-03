"""v0.35.8 — the startup schema alignment.

The Python side has no Flyway: ``create_all`` never alters an existing table, so a
model whose columns changed leaves the live database behind. ``align_schema`` replays
the known drifts and is a no-op once they are applied.
"""
from sqlalchemy import create_engine, inspect, text

from app.adapters.persistence.database import align_schema


def _legacy_engine():
    """A database shaped like the pre-v0.35.8 models."""
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE list_locations_neighbors (
                id INTEGER, id_story INTEGER, uuid TEXT,
                id_location_from INTEGER, id_location_to INTEGER, direction TEXT,
                condition_key TEXT, condition_value TEXT
            )
        """))
    return engine


def test_align_schema_renames_and_adds_the_neighbor_columns():
    engine = _legacy_engine()

    applied = align_schema(engine)

    columns = {c["name"] for c in inspect(engine).get_columns("list_locations_neighbors")}
    assert "condition_registry_key" in columns and "condition_key" not in columns
    assert "condition_registry_value" in columns and "condition_value" not in columns
    assert {"id_text_go", "id_text_back"} <= columns
    # Step 36 added the registry operator to the same table, as TEXT and not as an integer.
    assert "registry_value_operator_condition" in columns
    assert any("registry_value_operator_condition TEXT" in a for a in applied)
    assert len(applied) == 5


def test_align_schema_is_idempotent():
    engine = _legacy_engine()
    align_schema(engine)

    # a second run has nothing left to do — and must not raise on the already-renamed table
    assert align_schema(engine) == []


def test_align_schema_skips_a_database_without_the_table():
    engine = create_engine("sqlite:///:memory:")
    assert align_schema(engine) == []


def test_align_schema_keeps_the_rows_it_renames():
    engine = _legacy_engine()
    with engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO list_locations_neighbors (id, id_story, uuid, condition_key,"
            " condition_value) VALUES (1, 9, 'n-1', 'door', 'open')"))

    align_schema(engine)

    with engine.begin() as connection:
        row = connection.execute(text(
            "SELECT condition_registry_key, condition_registry_value"
            " FROM list_locations_neighbors WHERE id = 1")).one()
    assert tuple(row) == ("door", "open")
