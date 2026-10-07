package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.match.MatchLogWriterPort;
import games.paths.core.port.match.SnapshotPort;
import games.paths.core.port.match.SnapshotPort.CheckError;
import games.paths.core.port.match.SnapshotPort.SnapshotException;
import games.paths.core.port.match.SnapshotStorePort;
import games.paths.core.port.match.SnapshotStorePort.MatchRef;
import games.paths.core.port.match.SnapshotStorePort.NewSnapshot;
import games.paths.core.port.match.SnapshotStorePort.StoredSnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** SnapshotService (v0.41.1) — time-end write and pruning, list, every check code, restore. */
@DisplayName("SnapshotService (v0.41.1)")
class SnapshotServiceTest {

    private static final long MATCH_ID = 5L;
    private static final long STORY_ID = 9L;
    private static final String MATCH_UUID = "match-uuid";
    private static final MatchRef MATCH = new MatchRef(MATCH_ID, MATCH_UUID, STORY_ID, "RUNNING", 3);

    private SnapshotStorePort store;
    private TimeAdvancementService time;
    private MatchLogWriterPort logWriter;
    private SnapshotService service;

    @BeforeEach
    void setUp() {
        store = mock(SnapshotStorePort.class);
        time = mock(TimeAdvancementService.class);
        logWriter = mock(MatchLogWriterPort.class);
        service = new SnapshotService(store, 10);
        service.setTimeService(time);
        service.setLogWriter(logWriter);
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(MATCH));
        when(store.findMatchById(MATCH_ID)).thenReturn(Optional.of(MATCH));
        when(store.existingStoryIds(anyString(), anyString(), anyLong(), anyCollection()))
                .thenAnswer(inv -> new HashSet<>(inv.<java.util.Collection<Long>>getArgument(3)));
        when(store.existingUserIds(anyCollection()))
                .thenAnswer(inv -> new HashSet<>(inv.<java.util.Collection<Long>>getArgument(0)));
    }

    private static Map<String, List<Map<String, Object>>> state() {
        Map<String, Object> match = new LinkedHashMap<>();
        match.put("id", MATCH_ID);
        match.put("uuid", MATCH_UUID);
        match.put("status", "RUNNING");
        match.put("current_clock", 3);
        match.put("id_current_weather", 1);
        match.put("id_user_creator", 42);
        Map<String, Object> character = new LinkedHashMap<>();
        character.put("id", 1);
        character.put("id_user", 42);
        character.put("id_location", 2);
        character.put("id_class", 1);
        character.put("id_character_template", 1);
        character.put("is_sleeping", 1);
        Map<String, Object> trait = new LinkedHashMap<>();
        trait.put("id", 1);
        trait.put("id_traits", 7);
        trait.put("id_event", 0);
        Map<String, Object> registry = new LinkedHashMap<>();
        registry.put("key", "quest");
        registry.put("id_event", 14);
        registry.put("id_choice", null);
        registry.put("id_mission", 1);
        Map<String, List<Map<String, Object>>> state = new LinkedHashMap<>();
        state.put("gaming_match", List.of(match));
        state.put("gaming_character_instance", List.of(character));
        state.put("gaming_character_traits", List.of(trait));
        state.put("gaming_state_registry", List.of(registry));
        return state;
    }

    private static Map<String, Long> marks() {
        Map<String, Long> marks = new LinkedHashMap<>();
        marks.put("log_events", 12L);
        marks.put("log_movements", 0L);
        return marks;
    }

    private static String payloadJson(Object version, String matchUuid, Object idStory) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("v", version);
        payload.put("matchUuid", matchUuid);
        payload.put("idStory", idStory);
        payload.put("clock", 3);
        payload.put("state", state());
        payload.put("logMarks", marks());
        return SnapshotService.canonical(payload);
    }

    private static StoredSnapshot stored(String json, String checksum) {
        return new StoredSnapshot(70L, "snap-uuid", 3, "LIGHT", "2026-09-28T10:00:00Z",
                "Time-end of clock 3", json.length(), json, checksum);
    }

    private void givenSnapshot(String json, String checksum) {
        when(store.find(MATCH_ID, "snap-uuid")).thenReturn(Optional.of(stored(json, checksum)));
    }

    private void givenValidSnapshot() {
        String json = payloadJson(1, MATCH_UUID, STORY_ID);
        givenSnapshot(json, SnapshotService.sha256(json));
    }

    // ── time-end ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("writes one LIGHT snapshot of the clock that ends, checksummed, then prunes")
    void writesAndPrunes() {
        when(store.readState(MATCH_ID)).thenReturn(state());
        when(store.logMarks(MATCH_ID)).thenReturn(marks());

        service.writeAtTimeEnd(MATCH_ID);

        ArgumentCaptor<NewSnapshot> captor = ArgumentCaptor.forClass(NewSnapshot.class);
        InOrder order = inOrder(store);
        order.verify(store).insert(captor.capture());
        order.verify(store).prune(MATCH_ID, 10);
        NewSnapshot s = captor.getValue();
        assertEquals(MATCH_ID, s.idMatch());
        assertEquals(STORY_ID, s.idStory());
        assertEquals(3, s.clock());
        assertEquals(SnapshotPort.TYPE_LIGHT, s.type());
        assertEquals("Time-end of clock 3", s.description());
        assertEquals(SnapshotService.sha256(s.payload()), s.checksum());
        assertEquals(64, s.checksum().length());
        Map<String, Object> payload = SnapshotService.parse(s.payload());
        assertEquals(1, payload.get("v"));
        assertEquals(MATCH_UUID, payload.get("matchUuid"));
        assertEquals(12, ((Map<?, ?>) payload.get("logMarks")).get("log_events"));
        assertTrue(s.payload().startsWith("{\"clock\":3,\"idStory\":9,\"logMarks\":"), "keys sorted");
    }

    @Test
    @DisplayName("keep 0 turns the snapshots off")
    void offWhenKeepIsZero() {
        new SnapshotService(store, 0).writeAtTimeEnd(MATCH_ID);

        verifyNoInteractions(store);
    }

    @Test
    @DisplayName("an unknown match writes nothing")
    void unknownMatch() {
        when(store.findMatchById(MATCH_ID)).thenReturn(Optional.empty());

        service.writeAtTimeEnd(MATCH_ID);

        verify(store, never()).insert(any());
    }

    @Test
    @DisplayName("a failing store never fails the time-end")
    void failureIsSwallowed() {
        when(store.readState(MATCH_ID)).thenThrow(new IllegalStateException("db down"));

        assertDoesNotThrow(() -> service.writeAtTimeEnd(MATCH_ID));
        verify(store, never()).insert(any());
    }

    // ── list ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("list maps the stored rows, newest first as the store answers them")
    void list() {
        when(store.list(MATCH_ID)).thenReturn(List.of(
                new StoredSnapshot(2L, "s2", 4, "LIGHT", "t2", "d2", 20L, null, "c2"),
                new StoredSnapshot(1L, "s1", 3, "LIGHT", "t1", "d1", 10L, null, "c1")));

        List<SnapshotPort.SnapshotSummary> rows = service.list(MATCH_UUID);

        assertEquals(2, rows.size());
        assertEquals(new SnapshotPort.SnapshotSummary("s2", 4, "LIGHT", "t2", "d2", 20L), rows.get(0));
        assertEquals("s1", rows.get(1).uuid());
    }

    @Test
    @DisplayName("an unknown match is MATCH_NOT_FOUND on every admin call")
    void unknownMatchEverywhere() {
        when(store.findMatchByUuid("nope")).thenReturn(Optional.empty());

        assertEquals(SnapshotException.Code.MATCH_NOT_FOUND,
                assertThrows(SnapshotException.class, () -> service.list("nope")).getCode());
        assertEquals(SnapshotException.Code.MATCH_NOT_FOUND,
                assertThrows(SnapshotException.class, () -> service.check("nope", "s")).getCode());
        assertEquals(SnapshotException.Code.MATCH_NOT_FOUND,
                assertThrows(SnapshotException.class, () -> service.restore("nope", "s")).getCode());
    }

    @Test
    @DisplayName("an unknown snapshot is SNAPSHOT_NOT_FOUND")
    void unknownSnapshot() {
        when(store.find(MATCH_ID, "zz")).thenReturn(Optional.empty());

        SnapshotException ex = assertThrows(SnapshotException.class, () -> service.check(MATCH_UUID, "zz"));
        assertEquals(SnapshotException.Code.SNAPSHOT_NOT_FOUND, ex.getCode());
        assertTrue(ex.getErrors().isEmpty());
    }

    // ── check ───────────────────────────────────────────────────────────────

    private List<String> codes(SnapshotPort.SnapshotCheck check) {
        List<String> out = new ArrayList<>();
        check.errors().forEach(e -> out.add(e.code()));
        return out;
    }

    @Test
    @DisplayName("a fresh snapshot is valid and the check writes nothing")
    void valid() {
        givenValidSnapshot();

        SnapshotPort.SnapshotCheck check = service.check(MATCH_UUID, "snap-uuid");

        assertTrue(check.valid());
        assertTrue(check.errors().isEmpty());
        verify(store, never()).restore(anyLong(), anyLong(), anyMap(), anyMap());
        verify(store, never()).insert(any());
        verify(store, never()).setStatus(anyLong(), anyString());
    }

    @Test
    @DisplayName("a changed payload is SNAPSHOT_CHECKSUM_MISMATCH")
    void checksumMismatch() {
        givenSnapshot(payloadJson(1, MATCH_UUID, STORY_ID), "0".repeat(64));

        assertEquals(List.of(SnapshotPort.CHECKSUM_MISMATCH), codes(service.check(MATCH_UUID, "snap-uuid")));
    }

    @Test
    @DisplayName("a PostgreSQL-normalised payload (spaces, other key order) still matches")
    void canonicalFormIgnoresLayout() {
        String json = payloadJson(1, MATCH_UUID, STORY_ID);
        String layout = "{\"v\": 1, " + json.substring(1).replace(",\"", ", \"");
        givenSnapshot(layout, SnapshotService.sha256(json));

        assertTrue(service.check(MATCH_UUID, "snap-uuid").valid());
    }

    @Test
    @DisplayName("an unreadable payload is SNAPSHOT_CHECKSUM_MISMATCH and nothing else")
    void unreadable() {
        givenSnapshot("{not json", "x");

        assertEquals(List.of(SnapshotPort.CHECKSUM_MISMATCH), codes(service.check(MATCH_UUID, "snap-uuid")));
    }

    @Test
    @DisplayName("an unknown version is SNAPSHOT_VERSION_UNKNOWN and stops the check")
    void unknownVersion() {
        String json = payloadJson(2, MATCH_UUID, STORY_ID);
        givenSnapshot(json, SnapshotService.sha256(json));

        assertEquals(List.of(SnapshotPort.VERSION_UNKNOWN), codes(service.check(MATCH_UUID, "snap-uuid")));
        verify(store, never()).existingStoryIds(anyString(), anyString(), anyLong(), anyCollection());
    }

    @Test
    @DisplayName("a missing version is SNAPSHOT_VERSION_UNKNOWN too")
    void missingVersion() {
        String json = payloadJson(null, MATCH_UUID, STORY_ID);
        givenSnapshot(json, SnapshotService.sha256(json));

        assertEquals(List.of(SnapshotPort.VERSION_UNKNOWN), codes(service.check(MATCH_UUID, "snap-uuid")));
    }

    @Test
    @DisplayName("another match or story is MATCH_MISMATCH")
    void matchMismatch() {
        String other = payloadJson(1, "other-match", STORY_ID);
        givenSnapshot(other, SnapshotService.sha256(other));
        assertEquals(List.of(SnapshotPort.MATCH_MISMATCH), codes(service.check(MATCH_UUID, "snap-uuid")));

        String story = payloadJson(1, MATCH_UUID, 99);
        givenSnapshot(story, SnapshotService.sha256(story));
        assertEquals(List.of(SnapshotPort.MATCH_MISMATCH), codes(service.check(MATCH_UUID, "snap-uuid")));

        String none = payloadJson(1, MATCH_UUID, null);
        givenSnapshot(none, SnapshotService.sha256(none));
        assertEquals(List.of(SnapshotPort.MATCH_MISMATCH), codes(service.check(MATCH_UUID, "snap-uuid")));
    }

    @Test
    @DisplayName("an entity gone from the story is STORY_ENTITY_MISSING, one error per id")
    void storyEntityMissing() {
        givenValidSnapshot();
        when(store.existingStoryIds(eq("list_traits"), eq("id"), eq(STORY_ID), anyCollection()))
                .thenReturn(Set.of());

        SnapshotPort.SnapshotCheck check = service.check(MATCH_UUID, "snap-uuid");

        assertFalse(check.valid());
        assertEquals(List.of(new CheckError(SnapshotPort.STORY_ENTITY_MISSING,
                "trait 7 is no longer in the story")), check.errors());
        verify(store).existingStoryIds("list_character_templates", "id_tipo", STORY_ID, Set.of(1L));
        verify(store).existingStoryIds("list_events", "id", STORY_ID, Set.of(14L));
        verify(store).existingStoryIds("list_missions", "id", STORY_ID, Set.of(1L));
        verify(store).existingStoryIds("list_weather_rules", "id", STORY_ID, Set.of(1L));
        verify(store, never()).existingStoryIds(eq("list_choices"), anyString(), anyLong(), anyCollection());
    }

    @Test
    @DisplayName("a user gone is USER_MISSING")
    void userMissing() {
        givenValidSnapshot();
        when(store.existingUserIds(anyCollection())).thenReturn(Set.of());

        SnapshotPort.SnapshotCheck check = service.check(MATCH_UUID, "snap-uuid");

        assertEquals(List.of(new CheckError(SnapshotPort.USER_MISSING, "user 42 no longer exists")),
                check.errors());
    }

    @Test
    @DisplayName("a payload without state rows asks nothing about users")
    void noRowsNoUserQuery() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("v", 1);
        payload.put("matchUuid", MATCH_UUID);
        payload.put("idStory", STORY_ID);
        payload.put("state", Map.of("gaming_match", "not a list", "gaming_state_locations",
                List.of("not a row")));
        String json = SnapshotService.canonical(payload);
        givenSnapshot(json, SnapshotService.sha256(json));

        assertTrue(service.check(MATCH_UUID, "snap-uuid").valid());
        verify(store, never()).existingUserIds(anyCollection());
    }

    // ── restore ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("rows back, ADMIN_ACTION at clock N, time-start without snapshot, then PAUSED")
    void restores() {
        givenValidSnapshot();
        when(store.restore(eq(MATCH_ID), eq(70L), anyMap(), anyMap())).thenReturn(6L);

        SnapshotPort.RestoreResult result = service.restore(MATCH_UUID, "snap-uuid");

        assertEquals(new SnapshotPort.RestoreResult("RESTORED", "snap-uuid", 3, MatchStatuses.PAUSED, 6L),
                result);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, List<Map<String, Object>>>> state = ArgumentCaptor.forClass(Map.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Long>> marks = ArgumentCaptor.forClass(Map.class);
        InOrder order = inOrder(store, logWriter, time);
        order.verify(store).restore(eq(MATCH_ID), eq(70L), state.capture(), marks.capture());
        order.verify(logWriter).write(MATCH_ID, null, null, 3, "ADMIN_SNAPSHOT_RESTORED clock=3");
        order.verify(time).startTimeAfterRestore(MATCH_UUID);
        order.verify(store).setStatus(MATCH_ID, MatchStatuses.PAUSED);
        assertEquals(12L, marks.getValue().get("log_events"));
        assertEquals(1, state.getValue().get("gaming_character_instance").size());
    }

    @Test
    @DisplayName("without the optional collaborators it still restores and pauses")
    void restoresWithoutCollaborators() {
        SnapshotService bare = new SnapshotService(store, 10);
        givenValidSnapshot();

        assertEquals("RESTORED", bare.restore(MATCH_UUID, "snap-uuid").status());
        verify(store).setStatus(MATCH_ID, MatchStatuses.PAUSED);
    }

    @Test
    @DisplayName("a failed check is SNAPSHOT_INTEGRITY_FAILED with its errors, and nothing is written")
    void refusesAFailedCheck() {
        givenSnapshot(payloadJson(1, MATCH_UUID, STORY_ID), "bad");

        SnapshotException ex = assertThrows(SnapshotException.class,
                () -> service.restore(MATCH_UUID, "snap-uuid"));

        assertEquals(SnapshotException.Code.SNAPSHOT_INTEGRITY_FAILED, ex.getCode());
        assertEquals(SnapshotPort.CHECKSUM_MISMATCH, ex.getErrors().get(0).code());
        verify(store, never()).restore(anyLong(), anyLong(), anyMap(), anyMap());
        verifyNoInteractions(logWriter, time);
        verify(store, never()).setStatus(anyLong(), anyString());
    }

    // ── v0.41.6 current owner ───────────────────────────────────────────────

    private static final MatchRef MOVED = new MatchRef(MATCH_ID, MATCH_UUID, STORY_ID, "RUNNING", 3, 77L);

    @Test
    @DisplayName("v0.41.6 restore after a move keeps the current creator and character owner")
    void restoreKeepsCurrentOwner() {
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(MOVED));
        when(store.characterUsers(MATCH_ID)).thenReturn(Map.of(1L, 77L));
        givenValidSnapshot();

        service.restore(MATCH_UUID, "snap-uuid");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, List<Map<String, Object>>>> state = ArgumentCaptor.forClass(Map.class);
        verify(store).restore(eq(MATCH_ID), eq(70L), state.capture(), anyMap());
        assertEquals(77L, state.getValue().get("gaming_match").get(0).get("id_user_creator"));
        assertEquals(77L, state.getValue().get("gaming_character_instance").get(0).get("id_user"));
    }

    @Test
    @DisplayName("v0.41.6 check after a move: the deleted old owner is no USER_MISSING, a gone character goes to the creator")
    void checkUsesCurrentOwner() {
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(MOVED));
        when(store.characterUsers(MATCH_ID)).thenReturn(Map.of());
        when(store.existingUserIds(anyCollection())).thenAnswer(inv -> {
            Set<Long> found = new HashSet<>(inv.<java.util.Collection<Long>>getArgument(0));
            found.remove(42L);
            return found;
        });
        givenValidSnapshot();

        assertTrue(service.check(MATCH_UUID, "snap-uuid").valid());
        verify(store).existingUserIds(Set.of(77L));
    }

    @Test
    @DisplayName("v0.41.6 applyOwner leaves the state untouched without a known creator")
    void applyOwnerWithoutCreator() {
        Map<String, List<Map<String, Object>>> state = new LinkedHashMap<>();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id_user_creator", 42);
        state.put("gaming_match", List.of(row));
        assertSame(state, SnapshotService.applyOwner(state, null, Map.of()));
        assertEquals(42, row.get("id_user_creator"));
        verify(store, never()).characterUsers(anyLong());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("asLong reads numbers and numeric text, nothing else")
    void asLong() {
        assertEquals(4L, SnapshotService.asLong(4));
        assertEquals(4L, SnapshotService.asLong(" 4 "));
        assertNull(SnapshotService.asLong("x"));
        assertNull(SnapshotService.asLong(" "));
        assertNull(SnapshotService.asLong(true));
        assertNull(SnapshotService.asLong(null));
    }

    @Test
    @DisplayName("parse is null for blank or non-object text; state and marks skip malformed parts")
    void parseAndShapes() {
        assertNull(SnapshotService.parse(null));
        assertNull(SnapshotService.parse(" "));
        assertNull(SnapshotService.parse("[1,2]"));
        assertTrue(SnapshotService.state(null).isEmpty());
        assertTrue(SnapshotService.logMarks(null).isEmpty());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("state", "nope");
        payload.put("logMarks", Map.of("log_events", "x"));
        assertTrue(SnapshotService.state(payload).isEmpty());
        assertTrue(SnapshotService.logMarks(payload).isEmpty());
    }

    @Test
    @DisplayName("an unserialisable payload is an IllegalStateException")
    void canonicalRefusesUnserialisable() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("x", new Object());
        assertThrows(IllegalStateException.class, () -> SnapshotService.canonical(payload));
    }

    @Test
    @DisplayName("the exception keeps its errors, never null")
    void exceptionErrors() {
        SnapshotException ex = new SnapshotException(SnapshotException.Code.SNAPSHOT_INTEGRITY_FAILED, "m", null);
        assertTrue(ex.getErrors().isEmpty());
        assertEquals("m", ex.getMessage());
    }
}
