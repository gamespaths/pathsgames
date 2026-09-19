package games.paths.core.persistence.match;

import games.paths.core.model.match.LogTable;
import games.paths.core.port.match.LogIdPort;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * LogIdAdapter - {@link LogIdPort} on the live database: PostgreSQL takes the id from the
 * table's BIGSERIAL sequence, any other engine (SQLite, single writer) keeps MAX(id) + 1.
 */
@Repository
public class LogIdAdapter implements LogIdPort {

    private static final Logger log = LoggerFactory.getLogger(LogIdAdapter.class);
    static final String POSTGRESQL = "PostgreSQL";

    private final DataSource dataSource;
    private final EntityManager entityManager;
    // null until the first call: the engine is probed once, on the transaction's connection
    private volatile Boolean sequences;

    public LogIdAdapter(DataSource dataSource, EntityManager entityManager) {
        this.dataSource = dataSource;
        this.entityManager = entityManager;
    }

    @Override
    public long nextId(LogTable table) {
        String sql = useSequences()
                ? "SELECT nextval('" + table.sequenceName() + "')"
                : "SELECT COALESCE(MAX(id), 0) + 1 FROM " + table.tableName();
        return ((Number) entityManager.createNativeQuery(sql).getSingleResult()).longValue();
    }

    private boolean useSequences() {
        Boolean known = sequences;
        if (known == null) {
            known = probePostgres();
            sequences = known;
        }
        return known;
    }

    /** True when the JDBC product is PostgreSQL; a failed probe falls back to MAX(id) + 1. */
    private boolean probePostgres() {
        Connection connection = null;
        try {
            connection = DataSourceUtils.getConnection(dataSource);
            return POSTGRESQL.equalsIgnoreCase(connection.getMetaData().getDatabaseProductName());
        } catch (SQLException | RuntimeException e) {
            log.warn("LogIdAdapter: cannot read the database product name, using MAX(id) + 1: {}", e.getMessage());
            return false;
        } finally {
            if (connection != null) {
                DataSourceUtils.releaseConnection(connection, dataSource);
            }
        }
    }
}
