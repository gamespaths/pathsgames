"""v0.38.1 — the next id of a log_* row.

The log_* tables carry the composite key (id, id_match) plus UNIQUE (id), so the id
is assigned by hand. Every writer used to read MAX(id) + 1 in its own transaction,
and under concurrent requests two of them got the same value (duplicate key on
``log_events_id_key`` during the EC2 stress test). On PostgreSQL the id now comes
from the table's sequence; SQLite is a single writer, so MAX(id) + 1 stays.
"""
from sqlalchemy import func, text

# Tables served, in the order the sequences are created / aligned at startup.
LOG_TABLES = ("log_events", "log_movements", "log_item_usage", "log_weather",
              "log_clock_history", "log_choices_executed")


def sequence_name(table: str) -> str:
    """The PostgreSQL sequence of a log table's id (the name BIGSERIAL gives it)."""
    return f"{table}_id_seq"


def next_log_id(session, entity) -> int:
    """The next globally unique id for a row of ``entity`` (a Log*Entity)."""
    table = entity.__tablename__
    if session.get_bind().dialect.name == "postgresql":
        return int(session.execute(text(f"SELECT nextval('{sequence_name(table)}')")).scalar())
    return int(session.query(func.coalesce(func.max(entity.id), 0)).scalar() or 0) + 1


def align_log_sequences(bind):
    """PostgreSQL only: make sure each log table has its sequence and that it sits past the
    rows already written (the schema may come from ``create_all``, which makes none)."""
    if bind.dialect.name != "postgresql":
        return []
    statements = []
    for table in LOG_TABLES:
        seq = sequence_name(table)
        statements.append(f"CREATE SEQUENCE IF NOT EXISTS {seq} OWNED BY {table}.id")
        statements.append(f"SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)")
    with bind.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
    return statements
