package games.paths.core.persistence.match;

import games.paths.core.port.match.KpiStorePort.KpiDailyRow;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/** KpiStoreAdapter (v0.41.2) on an in-memory SQLite: the ON CONFLICT upsert, the range read, uuid lookups. */
@DisplayName("KpiStoreAdapter (v0.41.2)")
class KpiStoreAdapterTest {

    private SingleConnectionDataSource dataSource;
    private JdbcTemplate jdbc;
    private KpiStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        dataSource = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE system_kpi_daily (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL UNIQUE,"
                + " story_uuid TEXT NOT NULL, day TEXT NOT NULL, metric TEXT NOT NULL, ref_uuid TEXT NOT NULL DEFAULT '',"
                + " value INTEGER NOT NULL DEFAULT 0, ts_insert TEXT NOT NULL, ts_update TEXT NOT NULL,"
                + " UNIQUE (story_uuid, day, metric, ref_uuid))");
        jdbc.execute("CREATE TABLE list_stories (id INTEGER PRIMARY KEY, uuid TEXT)");
        jdbc.execute("CREATE TABLE gaming_match (id INTEGER PRIMARY KEY, id_story INTEGER)");
        jdbc.execute("CREATE TABLE list_locations (id INTEGER, id_story INTEGER, uuid TEXT, PRIMARY KEY (id, id_story))");
        adapter = new KpiStoreAdapter(jdbc);
    }

    @AfterEach
    void tearDown() {
        dataSource.destroy();
    }

    @Test
    @DisplayName("the same key is incremented in place, a different ref is its own row")
    void upsertAddsTheDelta() {
        adapter.increment("s-1", "2026-09-29", "MATCH_STARTED", "", 1);
        adapter.increment("s-1", "2026-09-29", "MATCH_STARTED", null, 2);
        adapter.increment("s-1", "2026-09-29", "CHOICE", "c-1", 1);

        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM system_kpi_daily", Integer.class));
        assertEquals(3L, jdbc.queryForObject(
                "SELECT value FROM system_kpi_daily WHERE metric = 'MATCH_STARTED'", Long.class));
    }

    @Test
    @DisplayName("findRows reads the inclusive day range, for one story or for all")
    void findRows() {
        adapter.increment("s-1", "2026-09-27", "COMA", "", 1);
        adapter.increment("s-1", "2026-09-28", "COMA", "", 2);
        adapter.increment("s-2", "2026-09-29", "COMA", "", 4);
        adapter.increment("s-2", "2026-09-30", "COMA", "", 8);

        List<KpiDailyRow> one = adapter.findRows("s-1", "2026-09-28", "2026-09-29");
        assertEquals(List.of(new KpiDailyRow("s-1", "2026-09-28", "COMA", "", 2)), one);
        assertEquals(2, adapter.findRows(null, "2026-09-28", "2026-09-29").size());
    }

    @Test
    @DisplayName("the story of a match and the uuid of a location, empty when unknown")
    void lookups() {
        jdbc.update("INSERT INTO list_stories (id, uuid) VALUES (9, 'story-9')");
        jdbc.update("INSERT INTO gaming_match (id, id_story) VALUES (1, 9)");
        jdbc.update("INSERT INTO list_locations (id, id_story, uuid) VALUES (3, 9, 'loc-3'), (3, 8, 'other')");

        assertEquals(Optional.of("story-9"), adapter.findStoryUuidByMatch(1L));
        assertEquals(Optional.empty(), adapter.findStoryUuidByMatch(2L));
        assertEquals(Optional.of("loc-3"), adapter.findLocationUuid(9L, 3L));
        assertEquals(Optional.empty(), adapter.findLocationUuid(9L, 4L));
    }
}
