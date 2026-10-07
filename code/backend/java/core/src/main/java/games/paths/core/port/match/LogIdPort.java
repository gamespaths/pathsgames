package games.paths.core.port.match;

import games.paths.core.model.match.LogTable;

/**
 * LogIdPort - outbound port handing out the next id of a {@link LogTable} row.
 *
 * <p>The log_* tables carry a composite key {@code (id, id_match)} plus {@code UNIQUE (id)},
 * so JPA cannot generate the id: every writer used to read {@code MAX(id) + 1} inside its
 * own transaction, and under concurrent requests two of them got the same value
 * (v0.38.1: {@code duplicate key value violates unique constraint "log_events_id_key"}
 * during the EC2 stress test). This port puts the allocation in one place, where the
 * PostgreSQL sequence can be used instead.</p>
 */
public interface LogIdPort {

    /** The next globally unique id for a row of {@code table}. */
    long nextId(LogTable table);
}
