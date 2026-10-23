package games.paths.core.persistence.match;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import static org.junit.jupiter.api.Assertions.*;

/** v1.7.0 {@link MatchStampStoreAdapter} on an in-memory SQLite gaming_match table. */
class MatchStampStoreAdapterTest {

    private SingleConnectionDataSource dataSource;
    private JdbcTemplate jdbc;
    private MatchStampStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        dataSource = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE gaming_match (id INTEGER PRIMARY KEY, uuid TEXT, ts_update TEXT,"
                + " play_ms INTEGER NOT NULL DEFAULT 0)");
        jdbc.update("INSERT INTO gaming_match (id, uuid, ts_update, play_ms) VALUES (1, 'm-1', 't0', 100)");
        adapter = new MatchStampStoreAdapter(jdbc);
    }

    @AfterEach
    void tearDown() {
        dataSource.destroy();
    }

    @Test
    void readsAndStampsTheMatch() {
        assertEquals("t0", adapter.findTsUpdate("m-1").orElseThrow());
        assertTrue(adapter.findTsUpdate("none").isEmpty());
        assertTrue(adapter.stamp("m-1", "t1", 50));
        assertEquals("t1", adapter.findTsUpdate("m-1").orElseThrow());
        assertEquals(150L, jdbc.queryForObject("SELECT play_ms FROM gaming_match WHERE uuid = 'm-1'", Long.class));
        assertFalse(adapter.stamp("none", "t1", 50));
    }

    @Test
    void theClaimIsAConditionalUpdate() {
        assertTrue(adapter.claim("m-1", "t0", "t1", 20));
        assertEquals("t1", adapter.findTsUpdate("m-1").orElseThrow());
        assertEquals(120L, jdbc.queryForObject("SELECT play_ms FROM gaming_match WHERE uuid = 'm-1'", Long.class));
        assertFalse(adapter.claim("m-1", "t0", "t2", 20));
        assertEquals("t1", adapter.findTsUpdate("m-1").orElseThrow());
        assertEquals(120L, jdbc.queryForObject("SELECT play_ms FROM gaming_match WHERE uuid = 'm-1'", Long.class));
        assertFalse(adapter.claim("none", "t1", "t2", 20));
    }

    @Test
    void twoDevicesWithTheSameVersionOnlyOneWins() {
        String seenByA = adapter.findTsUpdate("m-1").orElseThrow();
        String seenByB = adapter.findTsUpdate("m-1").orElseThrow();
        boolean a = adapter.claim("m-1", seenByA, "tA", 1);
        boolean b = adapter.claim("m-1", seenByB, "tB", 1);
        assertTrue(a ^ b);
        assertEquals("tA", adapter.findTsUpdate("m-1").orElseThrow());
        assertEquals(101L, jdbc.queryForObject("SELECT play_ms FROM gaming_match WHERE uuid = 'm-1'", Long.class));
    }
}
