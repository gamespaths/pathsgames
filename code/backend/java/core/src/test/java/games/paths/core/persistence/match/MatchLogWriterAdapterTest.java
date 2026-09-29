package games.paths.core.persistence.match;

import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.model.match.LogTable;
import games.paths.core.port.match.LogIdPort;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.repository.match.LogEventsRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** MatchLogWriterAdapter (v0.41.1) — Step 41 log_events rows and the per-match row count. */
@DisplayName("MatchLogWriterAdapter (v0.41.1)")
class MatchLogWriterAdapterTest {

    private LogEventsRepository repository;
    private LogIdPort logIds;
    private EntityManager entityManager;
    private Query query;

    @BeforeEach
    void setUp() {
        repository = mock(LogEventsRepository.class);
        logIds = mock(LogIdPort.class);
        entityManager = mock(EntityManager.class);
        query = mock(Query.class);
        when(logIds.nextId(LogTable.EVENTS)).thenReturn(77L);
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(eq("idMatch"), anyLong())).thenReturn(query);
    }

    private MatchLogWriterAdapter adapter(long warnRows) {
        return new MatchLogWriterAdapter(repository, logIds, entityManager, warnRows);
    }

    @Test
    @DisplayName("write appends one log_events row with the allocated id")
    void writeAppendsARow() {
        adapter(5000).write(3L, null, 9L, 2, "MATCH_CREATED");

        ArgumentCaptor<LogEventsEntity> row = ArgumentCaptor.forClass(LogEventsEntity.class);
        verify(repository).save(row.capture());
        assertEquals(77L, row.getValue().getId());
        assertEquals(3L, row.getValue().getIdMatch());
        assertNull(row.getValue().getIdCharacterMatch());
        assertEquals(9L, row.getValue().getIdEvent());
        assertEquals(2, row.getValue().getClock());
        assertEquals("MATCH_CREATED", row.getValue().getLogMessage());
    }

    @Test
    @DisplayName("countRows sums every log table in one query")
    void countSumsEveryTable() {
        when(query.getSingleResult()).thenReturn(BigInteger.valueOf(42));

        assertEquals(42L, adapter(5000).countRows(3L));
        for (LogTable t : LogTable.values()) {
            assertTrue(MatchLogWriterAdapter.COUNT_SQL.contains("FROM " + t.tableName()), t.tableName());
        }
        verify(query).setParameter("idMatch", 3L);
    }

    @Test
    @DisplayName("countRows crossing the threshold still answers the count; a non-number reads 0")
    void countAtAndOverTheThreshold() {
        MatchLogWriterAdapter a = adapter(10);
        when(query.getSingleResult()).thenReturn(10L, 11L, "junk");

        assertEquals(10L, a.countRows(3L));
        assertEquals(11L, a.countRows(3L));
        assertEquals(0L, a.countRows(3L));
    }

    @Test
    @DisplayName("a zero threshold switches the check off")
    void zeroThresholdIsOff() {
        when(query.getSingleResult()).thenReturn(1_000_000L);

        assertEquals(1_000_000L, adapter(0).countRows(3L));
    }

    @Test
    @DisplayName("the port helpers build the stored messages")
    void portHelpers() {
        assertEquals("MATCH_STARTED", MatchLogWriterPort.lifecycle(MatchLogWriterPort.LIFECYCLE_STARTED));
        assertEquals("ADMIN_STOP", MatchLogWriterPort.admin(MatchLogWriterPort.ADMIN_STOP));
        assertEquals("ADMIN_STATUS PAUSED", MatchLogWriterPort.adminStatus("paused"));
        assertEquals("ADMIN_SNAPSHOT_RESTORED clock=5", MatchLogWriterPort.snapshotRestored(5));
    }
}
