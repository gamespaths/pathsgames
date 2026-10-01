package games.paths.core.service.match;

import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchExportPort.MatchExportException;
import games.paths.core.port.match.MatchExportStorePort;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.port.match.SnapshotPort;
import games.paths.core.port.match.SnapshotStorePort;
import games.paths.core.port.match.SnapshotStorePort.MatchRef;
import games.paths.core.port.match.SnapshotStorePort.StoredSnapshot;
import games.paths.core.port.story.StoryExportPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** v0.41.4 — the export sequence (decisions 45, 58): every status, NO_SNAPSHOT, integrity, size cap. */
@DisplayName("MatchExportService (v0.41.4)")
class MatchExportServiceTest {

    private static final String UUID = "0a0a0a0a-0000-4000-8000-000000000001";
    private static final String PAYLOAD = "{\"v\":1,\"matchUuid\":\"" + UUID + "\",\"idStory\":9,\"clock\":3,"
            + "\"state\":{\"gaming_match\":[{\"uuid\":\"" + UUID + "\",\"id_difficulty\":1,\"id_user_creator\":42,"
            + "\"current_clock\":3}],\"gaming_character_instance\":[]},\"logMarks\":{}}";

    private SnapshotStorePort snapshots;
    private SnapshotPort snapshotPort;
    private MatchExportStorePort store;
    private StoryExportPort storyExport;
    private MatchLogWriterPort logWriter;
    private MatchCommandPort commands;
    private MatchExportService service;

    @BeforeEach
    void setUp() {
        snapshots = mock(SnapshotStorePort.class);
        snapshotPort = mock(SnapshotPort.class);
        store = mock(MatchExportStorePort.class);
        storyExport = mock(StoryExportPort.class);
        logWriter = mock(MatchLogWriterPort.class);
        commands = mock(MatchCommandPort.class);
        MatchImportService importer = mock(MatchImportService.class);
        service = new MatchExportService(snapshots, snapshotPort, store, storyExport, importer, "0.41.4", "test", 5_000_000);
        service.setLogWriter(logWriter);
        service.setMatchCommands(commands);
        when(store.storyUuidById(9L)).thenReturn(Optional.of("s-1"));
        when(store.usersByIds(any())).thenReturn(Map.of(42L, Map.of("uuid", "u-42", "username", "a", "state", 6)));
        when(store.logRows(anyLong(), anyString(), anyLong())).thenReturn(List.of());
        when(store.dialect()).thenReturn("sqlite");
        when(snapshotPort.check(eq(UUID), anyString())).thenReturn(new SnapshotPort.SnapshotCheck(true, List.of()));
    }

    private void match(String status, boolean withSnapshot) {
        MatchRef ref = new MatchRef(1L, UUID, 9L, status, 3);
        when(snapshots.findMatchByUuid(UUID)).thenReturn(Optional.of(ref));
        when(snapshots.findMatchById(1L)).thenReturn(Optional.of(new MatchRef(1L, UUID, 9L, "PAUSED", 4)));
        StoredSnapshot s = new StoredSnapshot(5L, "snap-1", 3, "LIGHT", "t", "d", 10, null, "c");
        when(snapshots.list(1L)).thenReturn(withSnapshot ? List.of(s) : List.of());
        when(snapshots.find(1L, "snap-1")).thenReturn(Optional.of(new StoredSnapshot(5L, "snap-1", 3, "LIGHT", "t", "d",
                10, PAYLOAD, "c")));
    }

    @Test
    void aRunningMatchIsPausedRestoredLoggedAndResumed() {
        match("RUNNING", true);
        var result = service.exportMatch(UUID);
        assertEquals("match-0a0a0a0a-clock-3.json", result.fileName());
        assertTrue(result.canonical().contains("\"snapshotClock\":3"));
        assertNotNull(result.document().get("story"));
        verify(snapshots).setStatus(1L, "PAUSED");
        verify(snapshotPort).restore(UUID, "snap-1");
        verify(logWriter).write(1L, null, null, 4, "ADMIN_EXPORTED clock=3");
        verify(commands).updateMatch(UUID, "RUNNING", null, MatchLogWriterPort.ADMIN_RESUME);
    }

    @Test
    void aPausedMatchStaysPausedAndATerminalOneIsUntouched() {
        match("PAUSED", true);
        service.exportMatch(UUID);
        verify(snapshots, never()).setStatus(anyLong(), anyString());
        verify(snapshotPort).restore(UUID, "snap-1");
        verify(commands, never()).updateMatch(anyString(), anyString(), any(), anyString());

        setUp();
        match("ENDED", true);
        service.exportMatch(UUID);
        verify(snapshotPort, never()).restore(anyString(), anyString());
        verify(logWriter, never()).write(anyLong(), any(), any(), anyInt(), anyString());
    }

    @Test
    void refusals() {
        assertEquals(MatchExportException.Code.MATCH_NOT_FOUND,
                assertThrows(MatchExportException.class, () -> service.exportMatch(UUID)).getCode());
        match("CREATED", true);
        assertEquals(MatchExportException.Code.NO_SNAPSHOT,
                assertThrows(MatchExportException.class, () -> service.exportMatch(UUID)).getCode());
        match("RUNNING", false);
        assertEquals(MatchExportException.Code.NO_SNAPSHOT,
                assertThrows(MatchExportException.class, () -> service.exportMatch(UUID)).getCode());
    }

    @Test
    void anIntegrityFailurePutsTheStatusBack() {
        match("RUNNING", true);
        when(snapshotPort.check(UUID, "snap-1")).thenReturn(new SnapshotPort.SnapshotCheck(false,
                List.of(new SnapshotPort.CheckError("STORY_ENTITY_MISSING", "location 2"))));
        MatchExportException ex = assertThrows(MatchExportException.class, () -> service.exportMatch(UUID));
        assertEquals(MatchExportException.Code.SNAPSHOT_INTEGRITY_FAILED, ex.getCode());
        assertEquals("STORY_ENTITY_MISSING", ex.getErrors().get(0).code());
        verify(snapshots).setStatus(1L, "RUNNING");
        verify(snapshotPort, never()).restore(anyString(), anyString());
    }

    @Test
    void theSizeCapAndAVanishedSnapshot() {
        match("RUNNING", true);
        MatchExportService tiny = new MatchExportService(snapshots, snapshotPort, store, storyExport,
                mock(MatchImportService.class), "0.41.4", "test", 10);
        assertEquals(MatchExportException.Code.EXPORT_TOO_LARGE,
                assertThrows(MatchExportException.class, () -> tiny.exportMatch(UUID)).getCode());
        verify(snapshots).setStatus(1L, "RUNNING");
        when(snapshots.find(1L, "snap-1")).thenReturn(Optional.empty());
        assertEquals(MatchExportException.Code.NO_SNAPSHOT,
                assertThrows(MatchExportException.class, () -> service.exportMatch(UUID)).getCode());
    }

    @Test
    void titleAndHelpers() {
        assertEquals("Hi", MatchExportService.title(Map.of("idTextTitle", 1, "texts", List.of(
                Map.of("idText", 1, "lang", "it", "shortText", "Ciao"), Map.of("idText", 1, "lang", "en", "shortText", "Hi")))));
        assertEquals("Lungo", MatchExportService.title(Map.of("idTextTitle", 1, "texts", List.of(
                Map.of("idText", 1, "lang", "it", "longText", "Lungo"), Map.of("idText", 1, "lang", "de", "shortText", "x"),
                Map.of("idText", 2, "lang", "en", "shortText", "no")))));
        assertNull(MatchExportService.title(Map.of()));
        assertEquals(Map.of("a", 1L), MatchExportService.idByUuid(Map.of("x", List.of(Map.of("uuid", "a", "id", 1),
                Map.of("id", 2), Map.of("uuid", "b"))), "x"));
        var engine = MatchExportService.engine(List.of(Map.of("id_location", 0)), Map.of("log_events", List.of(
                Map.of("log_message", "EVENT_EXECUTED 1"), Map.of("id_event", 2), Map.of("log_message", "x", "id_event", 3))));
        assertEquals(List.of(), engine.get("eventMarkers"));
        assertEquals(List.of(), engine.get("visitedLocationIds"));
    }

    @Test
    void theFacadeDelegatesTheImport() {
        MatchImportService importer = mock(MatchImportService.class);
        MatchExportService facade = new MatchExportService(snapshots, snapshotPort, store, storyExport, importer,
                "v", "s", 1);
        when(importer.check(Map.of())).thenReturn(Map.of("valid", true));
        when(importer.importMatch(Map.of())).thenReturn(Map.of("status", "IMPORTED"));
        assertEquals(true, facade.check(Map.of()).get("valid"));
        assertEquals("IMPORTED", facade.importMatch(Map.of()).get("status"));
    }

    @Test
    void anUnknownStoryStillExports() {
        match("ENDED", true);
        when(store.storyUuidById(9L)).thenReturn(Optional.empty());
        var result = service.exportMatch(UUID);
        assertTrue(result.canonical().contains("\"data\":{}"));
    }
}
