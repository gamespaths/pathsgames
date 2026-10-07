package games.paths.core.service.match;

import games.paths.core.model.match.export.CanonicalJson;
import games.paths.core.model.match.export.MatchExportSamples;
import games.paths.core.model.match.export.SchemaValidator;
import games.paths.core.persistence.match.MatchExportStoreAdapter;
import games.paths.core.persistence.match.SnapshotStoreAdapter;
import games.paths.core.port.match.LogIdPort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchExportPort;
import games.paths.core.port.match.MatchExportPort.MatchExportException;
import games.paths.core.port.match.MatchExportStorePort;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.TransactionManager;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.port.story.StoryExportPort;
import games.paths.core.port.story.StoryImportPort;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * v0.41.4 — export then import on the real SQLite schema (every migration): snapshot, pause, file, restore,
 * EXPORTED row; dry-run, copy, MATCH_EXISTS, replace, CHARACTER_EXISTS, renamed user, one transaction.
 */
@DisplayName("Match export/import round trip on SQLite (v0.41.4)")
class MatchExportRoundTripTest {

    static final String STORY = "51515151-0000-4000-8000-000000000009";
    static final String MATCH = "0a0a0a0a-0000-4000-8000-000000000009";
    static final String C1 = "c4c4c4c4-0000-4000-8000-000000000091";
    static final String C2 = "c4c4c4c4-0000-4000-8000-000000000092";

    private SingleConnectionDataSource dataSource;
    private JdbcTemplate jdbc;
    private SnapshotService snapshots;
    private MatchExportService exporter;
    private MatchImportService importer;
    private MatchCommandPort commands;
    private StoryImportPort storyImport;

    static Map<String, Object> story() {
        Map<String, Object> story = new LinkedHashMap<>();
        story.put("uuid", STORY);
        story.put("id", 9);
        story.put("idTextTitle", 1);
        story.put("idLocationStart", 1);
        story.put("texts", List.of(Map.of("id", 1, "idText", 1, "lang", "en", "shortText", "Round trip")));
        story.put("difficulties", List.of(Map.of("id", 1, "uuid", "d-9")));
        story.put("locations", List.of(Map.of("id", 1, "uuid", "loc-1"), Map.of("id", 2, "uuid", "loc-2")));
        story.put("characterTemplates", List.of(Map.of("id", 1, "uuid", "tpl-9")));
        story.put("classes", List.of(Map.of("id", 1, "uuid", "cls-9")));
        story.put("traits", List.of(Map.of("id", 1, "uuid", "trt-9")));
        story.put("items", List.of(Map.of("id", 5, "uuid", "itm-5")));
        story.put("events", List.of(Map.of("id", 13, "uuid", "ev-13"), Map.of("id", 14, "uuid", "ev-14")));
        story.put("choices", List.of(Map.of("id", 7, "uuid", "ch-7")));
        story.put("missions", List.of(Map.of("id", 1, "uuid", "mi-1")));
        story.put("weatherRules", List.of(Map.of("id", 1, "uuid", "w-1")));
        return story;
    }

    @BeforeEach
    void setUp() throws Exception {
        dataSource = RealSqliteSchema.create();
        jdbc = new JdbcTemplate(dataSource);
        seed();
        SnapshotStoreAdapter snapshotStore = new SnapshotStoreAdapter(jdbc);
        LogIdPort logIds = t -> jdbc.queryForObject("SELECT COALESCE(MAX(id), 0) + 1 FROM " + t.tableName(), Long.class);
        // A real @Transactional proxy: the one-transaction import is proven, not assumed.
        ProxyFactory proxy = new ProxyFactory(new MatchExportStoreAdapter(jdbc, logIds));
        proxy.addAdvice(new TransactionInterceptor((TransactionManager) new DataSourceTransactionManager(dataSource),
                new AnnotationTransactionAttributeSource()));
        MatchExportStorePort store = (MatchExportStorePort) proxy.getProxy();
        MatchLogWriterPort logWriter = new MatchLogWriterPort() {
            @Override
            public void write(long idMatch, Long idCharacter, Long idEvent, int clock, String message) {
                jdbc.update("INSERT INTO log_events (id, id_match, clock, log_message, timestamp) VALUES (?, ?, ?, ?, ?)",
                        logIds.nextId(games.paths.core.model.match.LogTable.EVENTS), idMatch, clock, message,
                        java.time.Instant.now().toString());
            }

            @Override
            public long countRows(long idMatch) {
                return 0;
            }
        };
        snapshots = new SnapshotService(snapshotStore, 10);
        snapshots.setLogWriter(logWriter);
        StoryExportPort storyExport = mock(StoryExportPort.class);
        when(storyExport.exportStory(STORY)).thenReturn(story());
        storyImport = mock(StoryImportPort.class);
        commands = mock(MatchCommandPort.class);
        importer = new MatchImportService(store, snapshotStore, storyExport, storyImport, null, "0.41.4", 5_000_000);
        importer.setEngine(snapshots, null, logWriter, commands);
        exporter = new MatchExportService(snapshotStore, snapshots, store, storyExport, importer, "0.41.4", "test",
                5_000_000);
        exporter.setLogWriter(logWriter);
        exporter.setMatchCommands(commands);
    }

    @AfterEach
    void tearDown() {
        dataSource.destroy();
    }

    private void seed() {
        jdbc.update("INSERT INTO users (id, uuid, username, state, role, email_address, password_hash)"
                + " VALUES (42, '00000000-0000-4000-8000-000000000042', 'robottest_creator', 6, 'PLAYER', 'c@x.org', 'secret-hash')");
        jdbc.update("INSERT INTO users (id, uuid, username, state, role) VALUES (43, '00000000-0000-4000-8000-000000000043', 'robottest_other', 2, 'ADMIN')");
        jdbc.update("INSERT INTO list_stories (id, uuid) VALUES (9, ?)", STORY);
        jdbc.update("INSERT INTO list_stories_difficulty (id, id_story) VALUES (1, 9)");
        jdbc.update("INSERT INTO list_locations (id, id_story) VALUES (1, 9), (2, 9), (3, 9)");
        for (String table : List.of("list_weather_rules", "list_classes", "list_traits", "list_missions")) {
            jdbc.update("INSERT INTO " + table + " (id, id_story) VALUES (1, 9)");
        }
        jdbc.update("INSERT INTO list_character_templates (id_tipo, id_story) VALUES (1, 9)");
        jdbc.update("INSERT INTO list_items (id, id_story) VALUES (5, 9)");
        jdbc.update("INSERT INTO list_events (id, id_story) VALUES (13, 9), (14, 9)");
        jdbc.update("INSERT INTO list_choices (id, id_story) VALUES (7, 9)");
        jdbc.update("INSERT INTO gaming_match (id, uuid, id_story, id_difficulty, id_user_creator, status, current_clock,"
                + " id_current_weather, name, rng_seed, character_template_uuid, class_uuid, trait_uuids,"
                + " id_character_current_turn) VALUES (1, ?, 9, 1, 42, 'RUNNING', 3, 1, 'robottest_rt', 42,"
                + " 'tpl-9', 'cls-9', 'trt-9', 1)", MATCH);
        jdbc.update("INSERT INTO gaming_character_instance (id, uuid, id_match, id_user, id_character_template, id_class,"
                + " id_location, energy, life, is_sleeping, characteristics) VALUES (1, ?, 1, 42, 1, 1, 2, 20, 10, 1, 'brave')", C1);
        jdbc.update("INSERT INTO gaming_character_instance (id, uuid, id_match, id_user, id_character_template,"
                + " id_location, energy, life) VALUES (2, ?, 1, 43, 1, 2, 5, 5)", C2);
        jdbc.update("INSERT INTO gaming_backpack_resources (id, id_match, id_character_match, coin) VALUES (1, 1, 1, 2)");
        jdbc.update("INSERT INTO gaming_character_traits (id, id_match, id_character_match, id_traits, id_event) VALUES (1, 1, 1, 1, 13)");
        jdbc.update("INSERT INTO gaming_inventory_items (id, id_match, id_character_match, id_item, amount) VALUES (1, 1, 1, 5, 2)");
        jdbc.update("INSERT INTO gaming_state_registry (id, id_match, key, string_value, id_character, id_event)"
                + " VALUES (1, 1, 'quest', 'done', 1, 14)");
        jdbc.update("INSERT INTO gaming_state_locations (id_match, id_location, flag_visited) VALUES (1, 1, 1), (1, 2, 1), (1, 3, 0)");
        jdbc.update("INSERT INTO gaming_turn_queue (id_match, id_character_match, clock, status, priority) VALUES (1, 1, 3, 'ACTIVE', 2)");
        jdbc.update("INSERT INTO gaming_story_progress (id, id_match, clock, id_event, id_choise) VALUES (1, 1, 2, 14, 7)");
        jdbc.update("INSERT INTO log_events (id, id_match, id_character_match, log_message, id_event, clock, timestamp)"
                + " VALUES (1, 1, 1, 'EVENT_EXECUTED 13', 13, 1, '2026-10-01T09:06:00Z'),"
                + " (2, 1, 1, 'EVENT_EXECUTED 14', 14, 2, '2026-10-01T09:10:00Z'),"
                + " (3, 1, 1, 'CHOICE_SELECTED 14', 14, 2, '2026-10-01T09:20:00Z'),"
                + " (4, 1, NULL, 'MATCH_CREATED', NULL, 0, '2026-10-01T08:59:00Z')");
        jdbc.update("INSERT INTO log_movements (id, id_match, id_character_match, id_location_from, id_location_to, energy, ts_insert)"
                + " VALUES (1, 1, 1, 1, 2, 2, '2026-10-01T09:05:00Z')");
        jdbc.update("INSERT INTO log_item_usage (id, id_match, id_character_match, id_item, action, food, effects_json, timestamp)"
                + " VALUES (1, 1, 1, 5, 'ADD', 1, '[]', '2026-10-01T09:21:00Z')");
        jdbc.update("INSERT INTO log_weather (id, id_match, clock, id_weather, timestamp_start) VALUES (1, 1, 1, 1, '2026-10-01T09:00:00Z')");
        jdbc.update("INSERT INTO log_clock_history (id, id_match, clock, timestamp_start) VALUES (1, 1, 2, '2026-10-01T09:25:00Z')");
        jdbc.update("INSERT INTO log_choices_executed (id, id_match, clock, id_event, id_choise, log_message)"
                + " VALUES (1, 1, 2, 14, 7, 'CHOICE_SELECTED 7')");
    }

    private Map<String, Object> exportAfterALaterAction() {
        snapshots.writeAtTimeEnd(1L);
        jdbc.update("INSERT INTO log_events (id, id_match, log_message, timestamp) VALUES (50, 1, 'ACTION_SLEEP', '2026-10-01T10:00:00Z')");
        jdbc.update("UPDATE gaming_character_instance SET energy = 1 WHERE id = 1");
        MatchExportPort.ExportResult result = exporter.exportMatch(MATCH);
        assertTrue(result.fileName().startsWith("match-0a0a0a0a-clock-3"));
        @SuppressWarnings("unchecked")
        Map<String, Object> doc = (Map<String, Object>) CanonicalJson.parse(result.canonical());
        return doc;
    }

    @Test
    void exportIsValidRestoresTheSourceAndLogsIt() {
        Map<String, Object> doc = exportAfterALaterAction();
        assertEquals(List.of(), SchemaValidator.matchExportV1().validate(doc));
        Map<String, Object> body = new LinkedHashMap<>(doc);
        body.remove("checksum");
        assertEquals(doc.get("checksum"), CanonicalJson.sha256(body));
        assertEquals("sqlite", MatchExportSamples.section(doc, "source").get("dialect"));
        assertEquals(8, MatchExportSamples.list(doc, "logs").size());
        assertFalse(CanonicalJson.write(doc).contains("secret-hash"));
        assertEquals(List.of(Map.of("eventId", 13L, "executed", 1L, "selected", 0L),
                Map.of("eventId", 14L, "executed", 1L, "selected", 1L)),
                MatchExportSamples.section(doc, "engine").get("eventMarkers"));
        assertEquals(List.of(2L, 1L), MatchExportSamples.section(doc, "engine").get("visitedLocationIds"));
        @SuppressWarnings("unchecked")
        Map<String, Object> c1 = (Map<String, Object>) MatchExportSamples.list(doc, "characters").get(0);
        assertEquals(20L, c1.get("energy"));
        assertEquals(true, c1.get("isSleeping"));
        assertEquals(2, ((List<?>) MatchExportSamples.section(doc, "state").get("locations")).size());
        // The source: rolled back to the snapshot, EXPORTED row, resume asked for.
        assertEquals(20, jdbc.queryForObject("SELECT energy FROM gaming_character_instance WHERE id = 1", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM log_events WHERE log_message = 'ACTION_SLEEP'", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM log_events WHERE log_message = 'ADMIN_EXPORTED clock=3'", Integer.class));
        verify(commands).updateMatch(MATCH, "RUNNING", null, MatchLogWriterPort.ADMIN_RESUME);
    }

    private static Map<String, Object> copyOf(Map<String, Object> doc, String matchUuid, String c1, String c2) {
        String text = CanonicalJson.write(doc).replace(MATCH, matchUuid).replace(C1, c1).replace(C2, c2);
        @SuppressWarnings("unchecked")
        Map<String, Object> copy = (Map<String, Object>) CanonicalJson.parse(text);
        return MatchExportSamples.withChecksum(copy);
    }

    private static Map<String, Object> request(Map<String, Object> export, Object... options) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("export", export);
        for (int i = 0; i < options.length; i += 2) {
            r.put((String) options[i], options[i + 1]);
        }
        return r;
    }

    @Test
    void aCopyIsImportedInOneGoAndTheOriginalNeedsReplace() {
        Map<String, Object> doc = exportAfterALaterAction();
        String copyUuid = "0a0a0a0a-0000-4000-8000-0000000000c1";
        Map<String, Object> copy = copyOf(doc, copyUuid, "c4c4c4c4-0000-4000-8000-0000000000c1",
                "c4c4c4c4-0000-4000-8000-0000000000c2");

        // The mocked resume did not write: put the source back to RUNNING as the real one does.
        jdbc.update("UPDATE gaming_match SET status = 'RUNNING' WHERE id = 1");
        Map<String, Object> check = importer.check(request(copy, "dryRun", true));
        assertEquals(true, check.get("valid"), check.toString());
        assertEquals("SAME", ((Map<?, ?>) check.get("story")).get("status"));
        assertEquals("USE_EXISTING", ((Map<?, ?>) check.get("story")).get("action"));
        assertEquals(List.of("EXISTING", "EXISTING"),
                ((List<?>) check.get("users")).stream().map(u -> ((Map<?, ?>) u).get("status")).toList());
        assertTrue(check.toString().contains("CROSS_FAMILY") == false);
        assertTrue(check.toString().contains("USER_HAS_ACTIVE_MATCH"), check.toString());

        Map<String, Object> result = importer.importMatch(request(copy, "startPaused", true));
        assertEquals("IMPORTED", result.get("status"));
        assertEquals("PAUSED", result.get("matchStatus"));
        assertEquals(3, result.get("snapshotClock"));
        verify(commands).updateMatch(MATCH, "PAUSED", null, MatchLogWriterPort.ADMIN_PAUSE);
        verify(storyImport, never()).importStory(any());
        long id = jdbc.queryForObject("SELECT id FROM gaming_match WHERE uuid = ?", Long.class, copyUuid);
        assertEquals("PAUSED", jdbc.queryForObject("SELECT status FROM gaming_match WHERE id = ?", String.class, id));
        assertEquals("trt-9", jdbc.queryForObject("SELECT trait_uuids FROM gaming_match WHERE id = ?", String.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT id_character_current_turn FROM gaming_match WHERE id = ?", Integer.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT is_sleeping FROM gaming_character_instance WHERE id_match = ? AND id = 1",
                Integer.class, id));
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM gaming_state_locations WHERE id_match = ?", Integer.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM log_events WHERE id_match = ? AND log_message LIKE 'ADMIN_IMPORTED test clock=3'",
                Integer.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM log_events WHERE id_match = ? AND log_message LIKE 'EVENT_EXECUTED 13%'",
                Integer.class, id));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM log_choices_executed WHERE id_match = ?", Integer.class, id));
        assertEquals("Imported at clock 3", jdbc.queryForObject(
                "SELECT description FROM system_snapshot WHERE id_match = ?", String.class, id));
        assertEquals(result.get("uuidSnapshot"), jdbc.queryForObject("SELECT uuid FROM system_snapshot WHERE id_match = ?", String.class, id));

        MatchExportException exists = assertThrows(MatchExportException.class, () -> importer.importMatch(request(copy)));
        assertEquals(MatchExportException.Code.MATCH_EXISTS, exists.getCode());

        Map<String, Object> replaced = importer.importMatch(request(copy, "replace", true));
        assertEquals("RUNNING", replaced.get("matchStatus"));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM gaming_match WHERE uuid = ?", Integer.class, copyUuid));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM gaming_character_instance WHERE id_match = ?", Integer.class, id));

        Map<String, Object> clash = copyOf(doc, "0a0a0a0a-0000-4000-8000-0000000000c3",
                "c4c4c4c4-0000-4000-8000-0000000000c1", "c4c4c4c4-0000-4000-8000-0000000000c4");
        MatchExportException ce = assertThrows(MatchExportException.class, () -> importer.importMatch(request(clash)));
        assertEquals(MatchExportException.Code.CHARACTER_EXISTS, ce.getCode());
    }

    @Test
    void newUsersAreCopiedWithoutSecretsAndRenamedOnAClash() {
        Map<String, Object> doc = exportAfterALaterAction();
        String text = CanonicalJson.write(doc).replace(MATCH, "0a0a0a0a-0000-4000-8000-0000000000d1")
                .replace(C1, "c4c4c4c4-0000-4000-8000-0000000000d1").replace(C2, "c4c4c4c4-0000-4000-8000-0000000000d2")
                .replace("\"00000000-0000-4000-8000-000000000042\"", "\"abcdef12-0000-4000-8000-000000000042\"")
                .replace("\"00000000-0000-4000-8000-000000000043\"", "\"fedcba98-0000-4000-8000-000000000043\"")
                .replace("c@x.org", "new@x.org");
        @SuppressWarnings("unchecked")
        Map<String, Object> copy = MatchExportSamples.withChecksum((Map<String, Object>) CanonicalJson.parse(text));
        Map<String, Object> result = importer.importMatch(request(copy));
        assertEquals(2L, result.get("usersCreated"));
        Map<String, Object> renamed = jdbc.queryForMap("SELECT * FROM users WHERE uuid = 'abcdef12-0000-4000-8000-000000000042'");
        assertEquals("robottest_creator_abcdef", renamed.get("username"));
        assertEquals("PLAYER", renamed.get("role"));
        assertEquals(6, renamed.get("state"));
        assertEquals("new@x.org", renamed.get("email_address"));
        assertNull(renamed.get("password_hash"));
        assertNull(renamed.get("guest_cookie_token"));
        assertEquals("PLAYER", jdbc.queryForObject(
                "SELECT role FROM users WHERE uuid = 'fedcba98-0000-4000-8000-000000000043'", String.class));
    }

    @Test
    void aFailingInsertRollsTheWholeImportBack() {
        Map<String, Object> doc = exportAfterALaterAction();
        String text = CanonicalJson.write(doc).replace(MATCH, "0a0a0a0a-0000-4000-8000-0000000000e1")
                .replace(C1, "c4c4c4c4-0000-4000-8000-0000000000e1").replace(C2, "c4c4c4c4-0000-4000-8000-0000000000e2")
                .replace("\"00000000-0000-4000-8000-000000000043\"", "\"fedcba98-0000-4000-8000-0000000000e3\"");
        @SuppressWarnings("unchecked")
        Map<String, Object> copy = MatchExportSamples.withChecksum((Map<String, Object>) CanonicalJson.parse(text));
        jdbc.execute("DROP TABLE log_clock_history");
        int matches = jdbc.queryForObject("SELECT COUNT(*) FROM gaming_match", Integer.class);
        assertThrows(RuntimeException.class, () -> importer.importMatch(request(copy)));
        assertEquals(matches, jdbc.queryForObject("SELECT COUNT(*) FROM gaming_match", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM gaming_character_instance WHERE uuid LIKE 'c4c4c4c4-%-0000000000e%'",
                Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE uuid = 'fedcba98-0000-4000-8000-0000000000e3'",
                Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM system_snapshot WHERE description LIKE 'Imported%'",
                Integer.class));
    }

    @Test
    void aNewUserWithTheEmailOfAnExistingOneIsMappedOntoIt() {
        Map<String, Object> doc = exportAfterALaterAction();
        String text = CanonicalJson.write(doc).replace(MATCH, "0a0a0a0a-0000-4000-8000-0000000000b1")
                .replace(C1, "c4c4c4c4-0000-4000-8000-0000000000b1").replace(C2, "c4c4c4c4-0000-4000-8000-0000000000b2")
                .replace("\"00000000-0000-4000-8000-000000000042\"", "\"abcdef12-0000-4000-8000-0000000000b4\"")
                .replace("c@x.org", "C@X.ORG");
        @SuppressWarnings("unchecked")
        Map<String, Object> copy = MatchExportSamples.withChecksum((Map<String, Object>) CanonicalJson.parse(text));
        Map<String, Object> result = importer.importMatch(request(copy));
        assertEquals(0L, result.get("usersCreated"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE uuid = 'abcdef12-0000-4000-8000-0000000000b4'",
                Integer.class));
        assertEquals(42, jdbc.queryForObject("SELECT id_user_creator FROM gaming_match"
                + " WHERE uuid = '0a0a0a0a-0000-4000-8000-0000000000b1'", Integer.class));
        assertEquals(42, jdbc.queryForObject("SELECT id_user FROM gaming_character_instance"
                + " WHERE uuid = 'c4c4c4c4-0000-4000-8000-0000000000b1'", Integer.class));
    }
}
