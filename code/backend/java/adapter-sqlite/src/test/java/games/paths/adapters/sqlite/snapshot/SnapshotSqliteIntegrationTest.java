package games.paths.adapters.sqlite.snapshot;

import games.paths.core.persistence.match.SnapshotStoreAdapter;
import games.paths.core.port.match.SnapshotPort;
import games.paths.core.service.match.SnapshotService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v0.41.1 — the snapshot store and service on the real SQLite schema (every Flyway migration,
 * V0.41.1 included): write at the time-end, check, restore with the log cut, a deleted story entity.
 */
class SnapshotSqliteIntegrationTest {

    private Path db;
    private SingleConnectionDataSource dataSource;
    private JdbcTemplate jdbc;
    private SnapshotService service;

    @BeforeEach
    void migrate() throws IOException {
        db = Files.createTempFile("pathsgames-snapshot-", ".sqlite");
        dataSource = new SingleConnectionDataSource("jdbc:sqlite:" + db, true);
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration/v0").load().migrate();
        jdbc = new JdbcTemplate(dataSource);
        service = new SnapshotService(new SnapshotStoreAdapter(jdbc), 2);

        jdbc.update("INSERT INTO users (id, username) VALUES (42, 'robottest_snapshot')");
        jdbc.update("INSERT INTO list_locations (id, id_story) VALUES (1, 9), (2, 9)");
        jdbc.update("INSERT INTO list_weather_rules (id, id_story) VALUES (1, 9)");
        jdbc.update("INSERT INTO list_classes (id, id_story) VALUES (1, 9)");
        jdbc.update("INSERT INTO list_character_templates (id_tipo, id_story) VALUES (1, 9)");
        jdbc.update("INSERT INTO gaming_match (id, uuid, id_story, id_difficulty, id_user_creator, status,"
                + " current_clock, id_current_weather, name) VALUES (1, 'm-1', 9, 1, 42, 'RUNNING', 3, 1, 'robottest')");
        jdbc.update("INSERT INTO gaming_character_instance (id, id_match, id_user, id_character_template, id_class,"
                + " id_location, energy, life, is_sleeping) VALUES (1, 1, 42, 1, 1, 1, 20, 10, 1)");
        jdbc.update("INSERT INTO gaming_backpack_resources (id, id_match, id_character_match, coin) VALUES (1, 1, 1, 2)");
        jdbc.update("INSERT INTO gaming_state_registry (id, id_match, key, string_value) VALUES (1, 1, 'quest', 'done')");
        jdbc.update("INSERT INTO gaming_state_locations (id_match, id_location, flag_visited) VALUES (1, 1, 1)");
        jdbc.update("INSERT INTO gaming_turn_queue (id_match, id_character_match, clock, status) VALUES (1, 1, 3, 'ACTIVE')");
        jdbc.update("INSERT INTO log_events (id, id_match, id_character_match, log_message) VALUES (1, 1, 1, 'before')");
    }

    @AfterEach
    void close() throws IOException {
        dataSource.destroy();
        Files.deleteIfExists(db);
    }

    private String only() {
        List<SnapshotPort.SnapshotSummary> rows = service.list("m-1");
        assertEquals(1, rows.size());
        return rows.get(0).uuid();
    }

    @Test
    void writesChecksAndRestoresOnTheRealSchema() {
        service.writeAtTimeEnd(1L);
        String uuid = only();
        assertEquals(3, service.list("m-1").get(0).clock());
        assertTrue(service.check("m-1", uuid).valid(), () -> service.check("m-1", uuid).errors().toString());

        jdbc.update("INSERT INTO log_events (id, id_match, id_character_match, log_message) VALUES (2, 1, 1, 'after')");
        jdbc.update("INSERT INTO log_movements (id, id_match, id_character_match, id_location_from, id_location_to)"
                + " VALUES (1, 1, 1, 1, 2)");
        jdbc.update("UPDATE gaming_character_instance SET id_location = 2, energy = 5 WHERE id = 1");
        jdbc.update("UPDATE gaming_match SET current_clock = 4, status = 'ENDED', timestamp_end = 'later' WHERE id = 1");
        jdbc.update("DELETE FROM gaming_state_registry");
        jdbc.update("INSERT INTO gaming_state_locations (id_match, id_location, flag_visited) VALUES (1, 2, 1)");

        SnapshotPort.RestoreResult result = service.restore("m-1", uuid);

        assertEquals("RESTORED", result.status());
        assertEquals(3, result.clock());
        assertEquals("PAUSED", result.matchStatus());
        assertEquals(2, result.logsRemoved());
        Map<String, Object> character = jdbc.queryForMap("SELECT * FROM gaming_character_instance WHERE id = 1");
        assertEquals(1, character.get("id_location"));
        assertEquals(20, character.get("energy"));
        Map<String, Object> match = jdbc.queryForMap("SELECT * FROM gaming_match WHERE id = 1");
        assertEquals("PAUSED", match.get("status"));
        assertEquals(3, match.get("current_clock"));
        assertNull(match.get("timestamp_end"));
        assertEquals("done", jdbc.queryForObject("SELECT string_value FROM gaming_state_registry", String.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM gaming_state_locations", Integer.class));
        assertEquals(List.of("before"), jdbc.queryForList("SELECT log_message FROM log_events", String.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM log_movements", Integer.class));
    }

    @Test
    void aDeletedStoryEntityFailsTheCheckAndTheRestore() {
        service.writeAtTimeEnd(1L);
        String uuid = only();
        jdbc.update("DELETE FROM list_locations WHERE id = 1");

        SnapshotPort.SnapshotCheck check = service.check("m-1", uuid);

        assertFalse(check.valid());
        assertEquals(SnapshotPort.STORY_ENTITY_MISSING, check.errors().get(0).code());
        SnapshotPort.SnapshotException ex = assertThrows(SnapshotPort.SnapshotException.class,
                () -> service.restore("m-1", uuid));
        assertEquals(SnapshotPort.SnapshotException.Code.SNAPSHOT_INTEGRITY_FAILED, ex.getCode());
        assertEquals("RUNNING", jdbc.queryForObject("SELECT status FROM gaming_match WHERE id = 1", String.class));
    }

    @Test
    void keepsOnlyTheNewestAndTheMatchDeleteTakesThemAway() {
        for (int clock = 3; clock <= 5; clock++) {
            jdbc.update("UPDATE gaming_match SET current_clock = ? WHERE id = 1", clock);
            service.writeAtTimeEnd(1L);
        }

        assertEquals(List.of(5, 4), service.list("m-1").stream().map(SnapshotPort.SnapshotSummary::clock).toList());
        assertEquals(2, new SnapshotStoreAdapter(jdbc).deleteByMatchIds(List.of(1L)));
        assertTrue(service.list("m-1").isEmpty());
    }
}
