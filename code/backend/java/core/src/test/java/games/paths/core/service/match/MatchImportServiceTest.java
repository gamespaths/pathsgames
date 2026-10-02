package games.paths.core.service.match;

import games.paths.core.model.match.export.MatchExportSamples;
import games.paths.core.model.story.StoryValidationReport;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchExportPort;
import games.paths.core.port.match.MatchExportPort.MatchExportException;
import games.paths.core.port.match.MatchExportStorePort;
import games.paths.core.port.match.MatchExportStorePort.ImportRows;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.port.match.SnapshotStorePort;
import games.paths.core.port.story.StoryExportPort;
import games.paths.core.port.story.StoryImportPort;
import games.paths.core.port.story.StoryValidatorPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** v0.41.4 — the import check and write (H.5): every error and warning code, story modes, time-start failure. */
@DisplayName("MatchImportService (v0.41.4)")
class MatchImportServiceTest {

    private static final String STORY = "51515151-0000-4000-8000-000000000001";
    private static final String MATCH = "0a0a0a0a-0000-4000-8000-000000000001";

    private MatchExportStorePort store;
    private SnapshotStorePort snapshotStore;
    private StoryExportPort storyExport;
    private StoryImportPort storyImport;
    private StoryValidatorPort validator;
    private SnapshotService snapshotService;
    private TimeAdvancementService timeService;
    private MatchLogWriterPort logWriter;
    private MatchCommandPort commands;
    private MatchImportService service;

    @BeforeEach
    void setUp() {
        store = mock(MatchExportStorePort.class);
        snapshotStore = mock(SnapshotStorePort.class);
        storyExport = mock(StoryExportPort.class);
        storyImport = mock(StoryImportPort.class);
        validator = mock(StoryValidatorPort.class);
        snapshotService = mock(SnapshotService.class);
        timeService = mock(TimeAdvancementService.class);
        logWriter = mock(MatchLogWriterPort.class);
        commands = mock(MatchCommandPort.class);
        service = new MatchImportService(store, snapshotStore, storyExport, storyImport, validator, "0.41.4", 5_000_000);
        service.setEngine(snapshotService, timeService, logWriter, commands);
        when(validator.validateImportData(any())).thenReturn(new StoryValidationReport());
        when(store.storyIdByUuid(STORY)).thenReturn(Optional.empty());
        when(store.userByUuid(anyString())).thenReturn(Optional.empty());
        when(store.matchOfCharacter(anyString())).thenReturn(Optional.empty());
        when(store.storyLocationIds(anyLong())).thenReturn(List.of(1L, 2L, 3L));
        when(store.insertImported(any())).thenReturn(77L);
        when(snapshotService.writeNow(eq(77L), anyString())).thenReturn("snap-77");
        when(snapshotStore.findMatchById(77L)).thenReturn(Optional.of(new SnapshotStorePort.MatchRef(77L, MATCH, 9L,
                "RUNNING", 4)));
    }

    private static Map<String, Object> request(Map<String, Object> doc, Object... options) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("export", doc);
        for (int i = 0; i < options.length; i += 2) {
            r.put((String) options[i], options[i + 1]);
        }
        return r;
    }

    private static List<String> codes(Map<String, Object> check, String key) {
        List<String> out = new ArrayList<>();
        ((List<?>) check.get(key)).forEach(i -> out.add((String) ((Map<?, ?>) i).get("code")));
        return out;
    }

    private Map<String, Object> storyOf(Map<String, Object> doc) {
        return MatchExportSamples.section(MatchExportSamples.section(doc, "story"), "data");
    }

    @Test
    void aStoryAbsentFromTheTargetIsImportedAndTheUsersCreated() {
        Map<String, Object> doc = MatchExportSamples.document();
        Map<String, Object> check = service.check(request(doc));
        assertEquals(true, check.get("valid"), check.toString());
        assertEquals("ABSENT", ((Map<?, ?>) check.get("story")).get("status"));
        assertEquals("IMPORT", ((Map<?, ?>) check.get("story")).get("action"));
        assertEquals(List.of("CROSS_FAMILY", "ROLE_DOWNGRADED", "VISITED_LOCATIONS_DIFFER").stream().filter(
                c -> !c.equals("VISITED_LOCATIONS_DIFFER")).toList(), codes(check, "warnings"));

        when(store.storyIdByUuid(STORY)).thenReturn(Optional.empty(), Optional.of(9L));
        when(storyExport.exportStory(STORY)).thenReturn(storyOf(doc));
        Map<String, Object> result = service.importMatch(request(doc));
        assertEquals("IMPORTED", result.get("status"));
        assertEquals("RUNNING", result.get("matchStatus"));
        assertEquals(4, result.get("clock"));
        assertEquals(2L, result.get("usersCreated"));
        assertEquals("snap-77", result.get("uuidSnapshot"));
        ArgumentCaptor<Map<String, Object>> story = ArgumentCaptor.captor();
        verify(storyImport).importStory(story.capture());
        assertFalse(story.getValue().containsKey("id"));
        ArgumentCaptor<ImportRows> rows = ArgumentCaptor.captor();
        verify(store).insertImported(rows.capture());
        ImportRows r = rows.getValue();
        assertNull(r.replaceUuid());
        assertEquals(2, r.newUsers().size());
        assertEquals("00000000-0000-4000-8000-0000000000a1", r.match().get("id_user_creator"));
        assertEquals("7a117a11-0000-4000-8000-000000000001", r.match().get("trait_uuids"));
        assertEquals(1L, r.activeOrdinal());
        assertEquals(3, r.childRows().get("gaming_state_locations").size());
        assertEquals(2, r.childRows().get("gaming_backpack_resources").size());
        assertEquals(11, r.logs().size());
        verify(logWriter).write(77L, null, null, 3, "ADMIN_IMPORTED test clock=3");
        verify(timeService).startTimeAfterRestore(MATCH);
        verify(snapshotStore).setStatus(77L, "RUNNING");
    }

    @Test
    void unreadableFilesAreRefused() {
        assertEquals(List.of("SCHEMA_INVALID"), codes(service.check(Map.of("export", "x")), "errors"));
        assertEquals(List.of("SCHEMA_INVALID"), codes(service.check(null), "errors"));

        Map<String, Object> doc = MatchExportSamples.document();
        doc.put("formatVersion", 2);
        assertEquals(List.of("FORMAT_UNKNOWN"), codes(service.check(request(doc)), "errors"));
        doc.put("formatVersion", "1");
        assertEquals(List.of("FORMAT_UNKNOWN"), codes(service.check(request(doc)), "errors"));

        doc = MatchExportSamples.document();
        doc.put("extra", true);
        assertTrue(codes(service.check(request(doc)), "errors").contains("SCHEMA_INVALID"));

        doc = MatchExportSamples.document();
        doc.put("checksum", "0".repeat(64));
        assertEquals(List.of("CHECKSUM_MISMATCH"), codes(service.check(request(doc)), "errors"));

        doc = MatchExportSamples.document();
        assertEquals(List.of("SCHEMA_INVALID"), codes(service.check(request(doc, "storyMode", "MERGE")), "errors"));

        MatchImportService tiny = new MatchImportService(store, snapshotStore, storyExport, storyImport, validator, "x", 10);
        Map<String, Object> big = MatchExportSamples.document();
        assertEquals(MatchExportException.Code.IMPORT_TOO_LARGE,
                assertThrows(MatchExportException.class, () -> tiny.check(request(big))).getCode());
    }

    @Test
    void referencesAreChecked() {
        Map<String, Object> doc = MatchExportSamples.document();
        @SuppressWarnings("unchecked")
        Map<String, Object> c2 = (Map<String, Object>) MatchExportSamples.list(doc, "characters").get(1);
        c2.put("ordinal", 1);
        c2.put("uuid", "c4c4c4c4-0000-4000-8000-000000000001");
        c2.put("userUuid", "00000000-0000-4000-8000-0000000000ff");
        MatchExportSamples.section(doc, "match").put("creatorUserUuid", "00000000-0000-4000-8000-0000000000fe");
        MatchExportSamples.section(doc, "match").put("activeCharacterUuid", "c4c4c4c4-0000-4000-8000-0000000000ff");
        @SuppressWarnings("unchecked")
        List<Object> turns = (List<Object>) MatchExportSamples.section(doc, "state").get("turns");
        turns.add(turns.get(0));
        MatchExportSamples.withChecksum(doc);
        Map<String, Object> check = service.check(request(doc));
        assertEquals(false, check.get("valid"));
        assertTrue(codes(check, "errors").stream().allMatch("REFERENCE_INVALID"::equals));
        String all = check.get("errors").toString();
        assertTrue(all.contains("listed twice") && all.contains("used twice") && all.contains("is not in users")
                && all.contains("unknown character") && all.contains("has two turns"), all);
    }

    @Test
    void storyModesOnADifferentStory() {
        Map<String, Object> doc = MatchExportSamples.document();
        Map<String, Object> target = new LinkedHashMap<>(storyOf(doc));
        target.put("title", "changed on the target");
        when(store.storyIdByUuid(STORY)).thenReturn(Optional.of(9L));
        when(storyExport.exportStory(STORY)).thenReturn(target);
        when(store.countMatchesOfStory(9L)).thenReturn(4);

        Map<String, Object> auto = service.check(request(doc));
        assertEquals(List.of("STORY_DIFFERS"), codes(auto, "errors"));
        MatchExportException ex = assertThrows(MatchExportException.class, () -> service.importMatch(request(doc)));
        assertEquals(MatchExportException.Code.STORY_DIFFERS, ex.getCode());

        Map<String, Object> keep = service.check(request(doc, "storyMode", "keep"));
        assertEquals(true, keep.get("valid"));
        assertEquals("KEEP", ((Map<?, ?>) keep.get("story")).get("action"));

        Map<String, Object> replace = service.check(request(doc, "storyMode", "REPLACE"));
        assertEquals(4, ((Map<?, ?>) replace.get("story")).get("matchesDeleted"));
        assertTrue(codes(replace, "warnings").contains("STORY_MATCHES_DELETED"));
        service.importMatch(request(doc, "storyMode", "REPLACE", "startPaused", true));
        verify(storyImport).importStory(any());
        verify(snapshotStore).setStatus(77L, "PAUSED");

        StoryValidationReport bad = new StoryValidationReport();
        bad.add("R_01", "event", "1", "id", "broken");
        when(validator.validateImportData(any())).thenReturn(bad);
        Map<String, Object> invalid = service.check(request(doc, "storyMode", "REPLACE"));
        assertEquals(List.of("STORY_INVALID"), codes(invalid, "errors"));
        assertTrue(invalid.get("errors").toString().contains("R_01"));
    }

    @Test
    void theSameStoryIsUsedAndItsMissingEntitiesReported() {
        Map<String, Object> doc = MatchExportSamples.document();
        Map<String, Object> target = storyOf(doc);
        when(store.storyIdByUuid(STORY)).thenReturn(Optional.of(9L));
        when(storyExport.exportStory(STORY)).thenReturn(target);
        Map<String, Object> same = service.check(request(doc));
        assertEquals("USE_EXISTING", ((Map<?, ?>) same.get("story")).get("action"));

        Map<String, Object> smaller = new LinkedHashMap<>(target);
        smaller.put("locations", List.of(Map.of("id", 1)));
        smaller.put("missionSteps", List.of());
        smaller.put("characterTemplates", List.of(Map.of("idTipo", 1)));
        when(storyExport.exportStory(STORY)).thenReturn(smaller);
        Map<String, Object> keep = service.check(request(doc, "storyMode", "KEEP"));
        assertEquals(List.of("STORY_ENTITY_MISSING", "STORY_ENTITY_MISSING"), codes(keep, "errors"));
        assertTrue(keep.get("errors").toString().contains("location 2"));
        assertTrue(keep.get("errors").toString().contains("mission step 1"));
        assertEquals(MatchExportException.Code.IMPORT_INVALID, assertThrows(MatchExportException.class,
                () -> service.importMatch(request(doc, "storyMode", "KEEP"))).getCode());
    }

    @Test
    void usersExistingRenamedAndTheirActiveMatchesPaused() {
        Map<String, Object> doc = MatchExportSamples.document();
        when(store.userByUuid("00000000-0000-4000-8000-0000000000a1")).thenReturn(Optional.of(Map.of("id", 42)));
        when(store.usernameTaken("admin_a2")).thenReturn(true);
        when(store.storyIdByUuid(STORY)).thenReturn(Optional.of(9L));
        when(storyExport.exportStory(STORY)).thenReturn(storyOf(doc));
        when(store.activeMatchesOf(List.of("00000000-0000-4000-8000-0000000000a1"), 9L, MATCH))
                .thenReturn(List.of(Map.of("uuid", "other-1", "status", "RUNNING")));
        Map<String, Object> check = service.check(request(doc));
        List<?> users = (List<?>) check.get("users");
        assertEquals("EXISTING", ((Map<?, ?>) users.get(0)).get("status"));
        assertEquals("RENAMED", ((Map<?, ?>) users.get(1)).get("status"));
        assertEquals("admin_a2_000000", ((Map<?, ?>) users.get(1)).get("targetUsername"));
        assertTrue(codes(check, "warnings").containsAll(List.of("USERNAME_RENAMED", "USER_HAS_ACTIVE_MATCH")));
        service.importMatch(request(doc));
        verify(commands).updateMatch("other-1", "PAUSED", null, MatchLogWriterPort.ADMIN_PAUSE);
    }

    @Test
    void twoNewUsersWithTheSameNameAreBothCreated() {
        Map<String, Object> doc = MatchExportSamples.document();
        @SuppressWarnings("unchecked")
        Map<String, Object> second = (Map<String, Object>) MatchExportSamples.list(doc, "users").get(1);
        second.put("username", "guest_a1");
        second.put("role", "PLAYER");
        MatchExportSamples.withChecksum(doc);
        List<?> users = (List<?>) service.check(request(doc)).get("users");
        assertEquals("RENAMED", ((Map<?, ?>) users.get(1)).get("status"));
    }

    @Test
    void conflictsOnMatchAndCharacters() {
        Map<String, Object> doc = MatchExportSamples.document();
        when(store.matchExists(MATCH)).thenReturn(true);
        when(store.matchOfCharacter("c4c4c4c4-0000-4000-8000-000000000001")).thenReturn(Optional.of(MATCH));
        when(store.matchOfCharacter("c4c4c4c4-0000-4000-8000-000000000002")).thenReturn(Optional.of("other"));
        Map<String, Object> check = service.check(request(doc));
        assertEquals(List.of("MATCH_EXISTS", "CHARACTER_EXISTS"), codes(check, "errors"));
        Map<String, Object> replace = service.check(request(doc, "replace", true));
        assertEquals(List.of("CHARACTER_EXISTS"), codes(replace, "errors"));
        assertEquals(MatchExportException.Code.MATCH_EXISTS,
                assertThrows(MatchExportException.class, () -> service.importMatch(request(doc))).getCode());

        when(store.matchOfCharacter("c4c4c4c4-0000-4000-8000-000000000002")).thenReturn(Optional.empty());
        when(store.storyIdByUuid(STORY)).thenReturn(Optional.of(9L));
        when(storyExport.exportStory(STORY)).thenReturn(storyOf(doc));
        service.importMatch(request(doc, "replace", true));
        ArgumentCaptor<ImportRows> rows = ArgumentCaptor.captor();
        verify(store).insertImported(rows.capture());
        assertEquals(MATCH, rows.getValue().replaceUuid());
    }

    @Test
    void markersAreReconciledAndTheVisitedSetCompared() {
        Map<String, Object> doc = MatchExportSamples.document();
        Map<String, Object> engine = MatchExportSamples.section(doc, "engine");
        engine.put("eventMarkers", List.of(Map.of("eventId", 13, "executed", 2, "selected", 0),
                Map.of("eventId", 14, "executed", 1, "selected", 0)));
        engine.put("visitedLocationIds", List.of(1));
        MatchExportSamples.withChecksum(doc);
        Map<String, Object> check = service.check(request(doc));
        assertTrue(codes(check, "warnings").containsAll(List.of("MARKERS_RECONCILED", "VISITED_LOCATIONS_DIFFER")));
        when(store.storyIdByUuid(STORY)).thenReturn(Optional.of(9L));
        when(storyExport.exportStory(STORY)).thenReturn(null);
        service.importMatch(request(doc, "storyMode", "KEEP"));
        ArgumentCaptor<ImportRows> rows = ArgumentCaptor.captor();
        verify(store).insertImported(rows.capture());
        List<String> messages = rows.getValue().logs().stream()
                .map(l -> String.valueOf(l.columns().get("log_message"))).toList();
        assertTrue(messages.contains("EVENT_EXECUTED 13 imported"), messages.toString());
        assertTrue(messages.contains("IMPORTED_UNCOUNTED CHOICE_SELECTED 14"), messages.toString());
    }

    @Test
    void aFailingTimeStartLeavesTheMatchPaused() {
        Map<String, Object> doc = MatchExportSamples.document();
        when(store.storyIdByUuid(STORY)).thenReturn(Optional.of(9L));
        when(storyExport.exportStory(STORY)).thenReturn(storyOf(doc));
        doThrow(new IllegalStateException("boom")).when(timeService).startTimeAfterRestore(MATCH);
        MatchExportException ex = assertThrows(MatchExportException.class, () -> service.importMatch(request(doc)));
        assertEquals(MatchExportException.Code.IMPORT_TIME_START_FAILED, ex.getCode());
        assertEquals(500, ex.getCode().status());
        verify(snapshotStore).setStatus(77L, "PAUSED");
        verify(snapshotStore, never()).setStatus(77L, "RUNNING");
    }

    @Test
    void theStoryMustBeThereAfterItsImport() {
        Map<String, Object> doc = MatchExportSamples.document();
        assertThrows(IllegalStateException.class, () -> service.importMatch(request(doc)));
    }

    @Test
    void withoutTheEngineCollaboratorsTheImportStillWrites() {
        MatchImportService bare = new MatchImportService(store, snapshotStore, storyExport, storyImport, null, "0.41.4",
                5_000_000);
        Map<String, Object> doc = MatchExportSamples.document();
        when(store.storyIdByUuid(STORY)).thenReturn(Optional.empty(), Optional.of(9L));
        Map<String, Object> result = bare.importMatch(request(doc));
        assertNull(result.get("uuidSnapshot"));
    }

    @Test
    void refusalPicksTheHttpStatus() {
        var conflict = MatchImportService.refusal(List.of(new MatchExportPort.Issue("STORY_DIFFERS", "x")));
        assertEquals(MatchExportException.Code.STORY_DIFFERS, conflict.getCode());
        var invalid = MatchImportService.refusal(List.of(new MatchExportPort.Issue("MATCH_EXISTS", "x"),
                new MatchExportPort.Issue("SCHEMA_INVALID", "y")));
        assertEquals(MatchExportException.Code.IMPORT_INVALID, invalid.getCode());
        assertEquals(2, invalid.getErrors().size());
        assertEquals(List.of(), new MatchExportException(MatchExportException.Code.NO_SNAPSHOT, "m").getErrors());
        assertEquals(Map.of(1L, "a"), MatchImportService.uuidById(Map.of("x", List.of(Map.of("id", 1, "uuid", "a"),
                Map.of("id", 2))), "x"));
    }

    @Test
    void aUserWithAKnownEmailIsMappedOntoTheExistingOne() {
        Map<String, Object> doc = MatchExportSamples.document();
        when(store.userByEmail("boss@example.org")).thenReturn(Optional.of(Map.of("id", 9,
                "uuid", "99999999-0000-4000-8000-000000000099", "username", "boss_here")));
        when(store.storyIdByUuid(STORY)).thenReturn(Optional.of(9L));
        when(storyExport.exportStory(STORY)).thenReturn(storyOf(doc));
        Map<String, Object> check = service.check(request(doc));
        Map<?, ?> mapped = (Map<?, ?>) ((List<?>) check.get("users")).get(1);
        assertEquals("MAPPED_BY_EMAIL", mapped.get("status"));
        assertEquals("99999999-0000-4000-8000-000000000099", mapped.get("targetUuid"));
        assertEquals("boss_here", mapped.get("targetUsername"));
        assertTrue(codes(check, "warnings").contains("USER_MAPPED_BY_EMAIL"));
        assertFalse(codes(check, "warnings").contains("ROLE_DOWNGRADED"));
        verify(store).activeMatchesOf(List.of("99999999-0000-4000-8000-000000000099"), 9L, MATCH);
        Map<String, Object> result = service.importMatch(request(doc));
        assertEquals(1L, result.get("usersCreated"));
        ArgumentCaptor<ImportRows> rows = ArgumentCaptor.captor();
        verify(store).insertImported(rows.capture());
        assertEquals(1, rows.getValue().newUsers().size());
        assertEquals("99999999-0000-4000-8000-000000000099", rows.getValue().characters().get(1).get("id_user"));
        assertEquals("00000000-0000-4000-8000-0000000000a1", rows.getValue().match().get("id_user_creator"));
    }
}
