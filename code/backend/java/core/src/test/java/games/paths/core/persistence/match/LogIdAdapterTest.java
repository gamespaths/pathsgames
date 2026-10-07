package games.paths.core.persistence.match;

import games.paths.core.model.match.LogTable;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.math.BigInteger;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * LogIdAdapter (v0.38.1) — the id allocation for the log_* tables: PostgreSQL sequence
 * or MAX(id) + 1, chosen once from the JDBC product name.
 */
@DisplayName("LogIdAdapter (v0.38.1)")
class LogIdAdapterTest {

    private DataSource dataSource;
    private Connection connection;
    private DatabaseMetaData metaData;
    private EntityManager entityManager;
    private Query query;
    private LogIdAdapter adapter;

    @BeforeEach
    void setUp() throws SQLException {
        dataSource = mock(DataSource.class);
        connection = mock(Connection.class);
        metaData = mock(DatabaseMetaData.class);
        entityManager = mock(EntityManager.class);
        query = mock(Query.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metaData);
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        adapter = new LogIdAdapter(dataSource, entityManager);
    }

    @Test
    @DisplayName("PostgreSQL: nextval on the table's BIGSERIAL sequence")
    void postgresUsesTheSequence() throws SQLException {
        when(metaData.getDatabaseProductName()).thenReturn("PostgreSQL");
        when(query.getSingleResult()).thenReturn(BigInteger.valueOf(42));

        assertEquals(42L, adapter.nextId(LogTable.EVENTS));

        verify(entityManager).createNativeQuery("SELECT nextval('log_events_id_seq')");
        verify(connection).close();
    }

    @Test
    @DisplayName("any other engine: MAX(id) + 1 in the caller's transaction")
    void otherEnginesUseMaxPlusOne() throws SQLException {
        when(metaData.getDatabaseProductName()).thenReturn("SQLite");
        when(query.getSingleResult()).thenReturn(7L);

        assertEquals(7L, adapter.nextId(LogTable.MOVEMENTS));

        verify(entityManager).createNativeQuery("SELECT COALESCE(MAX(id), 0) + 1 FROM log_movements");
    }

    @Test
    @DisplayName("the engine is probed once, then cached")
    void probesTheEngineOnce() throws SQLException {
        when(metaData.getDatabaseProductName()).thenReturn("PostgreSQL");
        when(query.getSingleResult()).thenReturn(1L, 2L);

        adapter.nextId(LogTable.WEATHER);
        adapter.nextId(LogTable.CLOCK_HISTORY);

        verify(dataSource, times(1)).getConnection();
        verify(entityManager).createNativeQuery("SELECT nextval('log_weather_id_seq')");
        verify(entityManager).createNativeQuery("SELECT nextval('log_clock_history_id_seq')");
    }

    @Test
    @DisplayName("a connection failure while probing falls back to MAX(id) + 1")
    void connectionFailureFallsBack() throws SQLException {
        when(dataSource.getConnection()).thenThrow(new SQLException("no connection"));
        when(query.getSingleResult()).thenReturn(3);

        assertEquals(3L, adapter.nextId(LogTable.ITEM_USAGE));

        verify(entityManager).createNativeQuery("SELECT COALESCE(MAX(id), 0) + 1 FROM log_item_usage");
    }

    @Test
    @DisplayName("a metadata failure while probing falls back to MAX(id) + 1 and releases the connection")
    void metadataFailureFallsBack() throws SQLException {
        when(connection.getMetaData()).thenThrow(new IllegalStateException("boom"));
        when(query.getSingleResult()).thenReturn(9L);

        assertEquals(9L, adapter.nextId(LogTable.CHOICES_EXECUTED));

        verify(entityManager).createNativeQuery("SELECT COALESCE(MAX(id), 0) + 1 FROM log_choices_executed");
        verify(connection).close();
    }
}
