package games.paths.core.persistence.match;

import games.paths.core.model.match.LogTable;
import games.paths.core.port.match.SnapshotStorePort.MatchRef;
import games.paths.core.port.match.SnapshotStorePort.NewSnapshot;
import games.paths.core.port.match.SnapshotStorePort.StoredSnapshot;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/** SnapshotStoreAdapter (v0.41.1) on an in-memory SQLite: generic row copy, list, prune, restore. */
@DisplayName("SnapshotStoreAdapter (v0.41.1)")
class SnapshotStoreAdapterTest {

    private SingleConnectionDataSource dataSource;
    private JdbcTemplate jdbc;
    private SnapshotStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        dataSource = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE users (id INTEGER PRIMARY KEY)");
        jdbc.execute("CREATE TABLE list_traits (id INTEGER, id_story INTEGER)");
        jdbc.execute("CREATE TABLE gaming_match (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, id_story INTEGER,"
                + " name TEXT, status TEXT, current_clock INTEGER, id_current_weather INTEGER,"
                + " id_character_current_turn INTEGER, counter_consecutive_pass INTEGER, timestamp_end TEXT,"
                + " timestamp_gameover TEXT, timestamp_lock_expiration TEXT, id_user_creator INTEGER, ts_update TEXT)");
        jdbc.execute("CREATE TABLE gaming_character_instance (id INTEGER, id_match INTEGER, uuid TEXT,"
                + " id_user INTEGER, energy INTEGER, life INTEGER, id_location INTEGER, is_sleeping INTEGER,"
                + " PRIMARY KEY (id, id_match))");
        jdbc.execute("CREATE TABLE gaming_turn_queue (id_match INTEGER, id_character_match INTEGER, uuid TEXT,"
                + " clock INTEGER, status TEXT)");
        jdbc.execute("CREATE TABLE gaming_active_choices (id INTEGER, id_match INTEGER, uuid TEXT, id_event INTEGER)");
        jdbc.execute("CREATE TABLE gaming_story_progress (id INTEGER, id_match INTEGER, uuid TEXT, id_event INTEGER)");
        jdbc.execute("CREATE TABLE gaming_state_registry (id INTEGER, id_match INTEGER, uuid TEXT, key TEXT,"
                + " string_value TEXT)");
        jdbc.execute("CREATE TABLE gaming_state_locations (id_match INTEGER, id_location INTEGER, uuid TEXT,"
                + " flag_visited INTEGER)");
        jdbc.execute("CREATE TABLE gaming_character_traits (id INTEGER, id_match INTEGER, uuid TEXT,"
                + " id_character_match INTEGER, id_traits INTEGER)");
        jdbc.execute("CREATE TABLE gaming_inventory_items (id INTEGER, id_match INTEGER, uuid TEXT,"
                + " id_character_match INTEGER, id_item INTEGER, amount INTEGER)");
        jdbc.execute("CREATE TABLE gaming_backpack_resources (id INTEGER, id_match INTEGER, uuid TEXT,"
                + " id_character_match INTEGER, food INTEGER, magic INTEGER, coin INTEGER)");
        for (LogTable t : LogTable.values()) {
            jdbc.execute("CREATE TABLE " + t.tableName() + " (id INTEGER, id_match INTEGER, note TEXT)");
        }
        jdbc.execute("CREATE TABLE system_snapshot (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, id_story INTEGER,"
                + " id_match INTEGER, timestamp TEXT DEFAULT (datetime('now')), type TEXT, jsonb_data TEXT,"
                + " file_path TEXT, description TEXT, clock INTEGER, checksum TEXT, ts_insert TEXT, ts_update TEXT)");
        adapter = new SnapshotStoreAdapter(jdbc);

        jdbc.update("INSERT INTO gaming_match (id, uuid, id_story, name, status, current_clock, id_current_weather,"
                + " id_character_current_turn, counter_consecutive_pass, id_user_creator) VALUES"
                + " (1, 'm-1', 9, 'robot', 'RUNNING', 3, 1, 1, 0, 42)");
        jdbc.update("INSERT INTO gaming_character_instance VALUES (1, 1, 'c-1', 42, 20, 10, 1, 1)");
        jdbc.update("INSERT INTO gaming_backpack_resources VALUES (1, 1, 'b-1', 1, 0, 0, 2)");
        jdbc.update("INSERT INTO gaming_state_registry VALUES (1, 1, 'r-1', 'quest', 'done')");
        jdbc.update("INSERT INTO gaming_turn_queue VALUES (1, 1, 't-1', 3, 'ACTIVE')");
        jdbc.update("INSERT INTO log_events VALUES (4, 1, 'before'), (5, 2, 'other match')");
    }

    @AfterEach
    void tearDown() {
        dataSource.destroy();
    }

    private void snapshot(int clock) {
        adapter.insert(new NewSnapshot(1L, 9L, clock, "LIGHT", "{\"clock\":" + clock + "}", "sum" + clock,
                "Time-end of clock " + clock));
    }

    @Test
    @DisplayName("the match is found by uuid and by id, an unknown one is empty")
    void findMatch() {
        assertEquals(new MatchRef(1L, "m-1", 9L, "RUNNING", 3, 42L), adapter.findMatchByUuid("m-1").orElseThrow());
        assertEquals("m-1", adapter.findMatchById(1L).orElseThrow().uuid());
        assertTrue(adapter.findMatchByUuid("nope").isEmpty());
    }

    @Test
    @DisplayName("v0.41.6 characterUsers maps character id to its user; a null creator reads as null")
    void characterUsers() {
        jdbc.update("INSERT INTO gaming_character_instance VALUES (2, 1, 'c-2', NULL, 20, 10, 1, 0)");
        Map<Long, Long> owners = adapter.characterUsers(1L);
        assertEquals(42L, owners.get(1L));
        assertTrue(owners.containsKey(2L));
        assertNull(owners.get(2L));
        assertTrue(adapter.characterUsers(99L).isEmpty());
        jdbc.update("UPDATE gaming_match SET id_user_creator = NULL WHERE id = 1");
        assertNull(adapter.findMatchById(1L).orElseThrow().idUserCreator());
    }

    @Test
    @DisplayName("readState copies every column of every state table, lower-case keys")
    void readState() {
        Map<String, List<Map<String, Object>>> state = adapter.readState(1L);

        assertEquals(List.of("gaming_match", "gaming_character_instance", "gaming_turn_queue",
                "gaming_active_choices", "gaming_story_progress", "gaming_state_registry",
                "gaming_state_locations", "gaming_character_traits", "gaming_inventory_items",
                "gaming_backpack_resources"), List.copyOf(state.keySet()));
        assertEquals("robot", state.get("gaming_match").get(0).get("name"));
        assertEquals(20, state.get("gaming_character_instance").get(0).get("energy"));
        assertEquals("done", state.get("gaming_state_registry").get(0).get("string_value"));
        assertTrue(state.get("gaming_inventory_items").isEmpty());
    }

    @Test
    @DisplayName("logMarks is the highest id of the match per log table, 0 when it has none")
    void logMarks() {
        Map<String, Long> marks = adapter.logMarks(1L);

        assertEquals(4L, marks.get("log_events"));
        assertEquals(0L, marks.get("log_movements"));
        assertEquals(LogTable.values().length, marks.size());
    }

    @Test
    @DisplayName("insert, list (newest first, no payload), find (payload and checksum)")
    void insertListFind() {
        snapshot(2);
        snapshot(3);

        List<StoredSnapshot> rows = adapter.list(1L);
        assertEquals(2, rows.size());
        assertEquals(3, rows.get(0).clock());
        assertNull(rows.get(0).payload());
        assertEquals("{\"clock\":3}".length(), rows.get(0).sizeBytes());
        assertEquals("LIGHT", rows.get(0).type());
        assertEquals("Time-end of clock 3", rows.get(0).description());
        assertNotNull(rows.get(0).timestamp());

        StoredSnapshot found = adapter.find(1L, rows.get(1).uuid()).orElseThrow();
        assertEquals("{\"clock\":2}", found.payload());
        assertEquals("sum2", found.checksum());
        assertTrue(adapter.find(1L, "nope").isEmpty());
        assertTrue(adapter.find(2L, rows.get(1).uuid()).isEmpty());
    }

    @Test
    @DisplayName("prune keeps the newest N")
    void prune() {
        for (int clock = 1; clock <= 4; clock++) {
            snapshot(clock);
        }

        assertEquals(2, adapter.prune(1L, 2));

        assertEquals(List.of(4, 3), adapter.list(1L).stream().map(StoredSnapshot::clock).toList());
    }

    @Test
    @DisplayName("existing story ids and users; empty input asks nothing; odd names are refused")
    void existing() {
        jdbc.update("INSERT INTO list_traits VALUES (1, 9), (2, 8)");
        jdbc.update("INSERT INTO users VALUES (42)");

        assertEquals(Set.of(1L), adapter.existingStoryIds("list_traits", "id", 9L, List.of(1L, 2L)));
        assertEquals(Set.of(), adapter.existingStoryIds("list_traits", "id", 9L, List.of()));
        assertEquals(Set.of(), adapter.existingStoryIds("list_traits", "id", 9L, null));
        assertEquals(Set.of(42L), adapter.existingUserIds(List.of(42L, 43L)));
        assertEquals(Set.of(), adapter.existingUserIds(List.of()));
        assertEquals(Set.of(), adapter.existingUserIds(null));
        assertThrows(IllegalArgumentException.class,
                () -> adapter.existingStoryIds("list_traits; DROP TABLE users", "id", 9L, List.of(1L)));
        assertThrows(IllegalArgumentException.class, () -> SnapshotStoreAdapter.identifier(null));
    }

    @Test
    @DisplayName("restore: log cut, characters in place, extra ones gone, children replaced, match row back")
    void restore() {
        Map<String, List<Map<String, Object>>> state = adapter.readState(1L);
        snapshot(3);
        long idSnapshot = adapter.list(1L).get(0).id();
        // What happens after the snapshot: new logs, a move, a new character, a turn row, an item, a newer snapshot.
        jdbc.update("INSERT INTO log_events VALUES (6, 1, 'after'), (7, 1, 'after')");
        jdbc.update("INSERT INTO log_movements VALUES (8, 1, 'after')");
        jdbc.update("UPDATE gaming_character_instance SET id_location = 2, energy = 5 WHERE id = 1");
        jdbc.update("INSERT INTO gaming_character_instance VALUES (2, 1, 'c-2', 42, 1, 1, 2, 0)");
        jdbc.update("INSERT INTO gaming_inventory_items VALUES (1, 1, 'i-1', 1, 3, 1)");
        jdbc.update("DELETE FROM gaming_state_registry");
        jdbc.update("UPDATE gaming_match SET status = 'ENDED', current_clock = 4, timestamp_end = 'x',"
                + " name = 'renamed' WHERE id = 1");
        snapshot(4);
        // A deleted character comes back as an insert.
        Map<String, Object> ghost = new LinkedHashMap<>(state.get("gaming_character_instance").get(0));
        ghost.put("id", 3);
        ghost.put("uuid", "c-3");
        ghost.put("id_match", 99);
        List<Map<String, Object>> characters = new java.util.ArrayList<>(state.get("gaming_character_instance"));
        characters.add(ghost);
        characters.add(new LinkedHashMap<>(Map.of("uuid", "no-id")));
        state.put("gaming_character_instance", characters);

        long removed = adapter.restore(1L, idSnapshot, state, Map.of("log_events", 4L));

        assertEquals(3, removed);
        assertEquals(List.of(4, 5), jdbc.queryForList("SELECT id FROM log_events ORDER BY id", Integer.class));
        Map<String, Object> c1 = jdbc.queryForMap("SELECT * FROM gaming_character_instance WHERE id = 1");
        assertEquals(1, c1.get("id_location"));
        assertEquals(20, c1.get("energy"));
        assertEquals(List.of(1, 3), jdbc.queryForList(
                "SELECT id FROM gaming_character_instance WHERE id_match = 1 ORDER BY id", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM gaming_inventory_items", Integer.class));
        assertEquals("done", jdbc.queryForObject("SELECT string_value FROM gaming_state_registry", String.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM gaming_turn_queue", Integer.class));
        Map<String, Object> m = jdbc.queryForMap("SELECT * FROM gaming_match WHERE id = 1");
        assertEquals("RUNNING", m.get("status"));
        assertEquals(3, m.get("current_clock"));
        assertNull(m.get("timestamp_end"));
        assertEquals("renamed", m.get("name"), "the name is not game state");
        assertNotNull(m.get("ts_update"));
        assertEquals(List.of(3), adapter.list(1L).stream().map(StoredSnapshot::clock).toList());
    }

    @Test
    @DisplayName("restore with no match row leaves the match row alone")
    void restoreWithoutMatchRow() {
        Map<String, List<Map<String, Object>>> state = new LinkedHashMap<>();
        adapter.restore(1L, 0L, state, Map.of());

        assertEquals("RUNNING", jdbc.queryForObject("SELECT status FROM gaming_match WHERE id = 1", String.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM gaming_character_instance", Integer.class));
    }

    @Test
    @DisplayName("a row without payload lists at size 0; a character row of keys alone updates nothing")
    void edges() {
        jdbc.update("INSERT INTO system_snapshot (uuid, id_story, id_match, type, clock) VALUES ('bare', 9, 1, 'LIGHT', 1)");
        assertEquals(0L, adapter.list(1L).get(0).sizeBytes());
        assertNull(adapter.find(1L, "bare").orElseThrow().payload());
        Map<String, List<Map<String, Object>>> state = new LinkedHashMap<>();
        state.put("gaming_character_instance", List.of(new LinkedHashMap<>(Map.of("id", 1, "id_match", 1))));

        adapter.restore(1L, 99L, state, Map.of("log_events", 99L));

        assertEquals(20, jdbc.queryForObject("SELECT energy FROM gaming_character_instance WHERE id = 1", Integer.class));
    }

    @Test
    @DisplayName("setStatus and deleteByMatchIds")
    void statusAndDelete() {
        snapshot(1);
        adapter.setStatus(1L, "PAUSED");

        assertEquals("PAUSED", jdbc.queryForObject("SELECT status FROM gaming_match WHERE id = 1", String.class));
        assertEquals(0, adapter.deleteByMatchIds(List.of()));
        assertEquals(0, adapter.deleteByMatchIds(null));
        assertEquals(1, adapter.deleteByMatchIds(List.of(1L, 2L)));
        assertTrue(adapter.list(1L).isEmpty());
    }

    @Test
    @DisplayName("plain keeps numbers, text and flags; anything else becomes its text")
    void plain() {
        assertEquals(1, SnapshotStoreAdapter.plain(1));
        assertEquals("a", SnapshotStoreAdapter.plain("a"));
        assertEquals(Boolean.TRUE, SnapshotStoreAdapter.plain(Boolean.TRUE));
        assertNull(SnapshotStoreAdapter.plain(null));
        assertEquals("2026-09-28", SnapshotStoreAdapter.plain(java.sql.Date.valueOf("2026-09-28")));
        assertEquals("\"key\"", SnapshotStoreAdapter.quote("key"));
    }
}
