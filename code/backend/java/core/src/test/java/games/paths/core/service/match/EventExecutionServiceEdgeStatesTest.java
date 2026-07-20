package games.paths.core.service.match;

import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.EventExecutionStorePort.EventActorView;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.EventExecutionStorePort.MatchEventView;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * EventExecutionService (Step 30) — the all-players-in-coma epilogue and its early exits.
 *
 * <p>The roster is a single character on purpose: in single player that one coma IS the whole
 * party going down, which is the path this step has to get right first.</p>
 */
@DisplayName("EventExecutionService edge states (Step 30)")
class EventExecutionServiceEdgeStatesTest {

    private static final String MATCH_UUID = "match-uuid";
    private static final String USER_UUID = "user-uuid";
    private static final String EVENT_UUID = "event-uuid";
    private static final long MATCH_ID = 1L;
    private static final long USER_ID = 2L;
    private static final long CHAR_ID = 3L;
    private static final long STORY_ID = 4L;
    private static final long LOC = 100L;
    private static final int CLOCK = 7;
    private static final long COMA_EVENT_ID = 5L;

    private EventExecutionStorePort store;
    private EdgeStateStorePort edgeStore;
    private EventExecutionService service;

    @BeforeEach
    void setUp() {
        store = mock(EventExecutionStorePort.class);
        edgeStore = mock(EdgeStateStorePort.class);
        UserAccessPort userAccessPort = mock(UserAccessPort.class);
        ContentQueryPort contentQueryPort = mock(ContentQueryPort.class);
        service = new EventExecutionService(store, edgeStore, userAccessPort, contentQueryPort,
                mock(TimeAdvancementService.class));

        when(userAccessPort.findByUuid(USER_UUID)).thenReturn(Optional.of(
                new UserAccessPort.UserView(USER_ID, USER_UUID, "player", "USER", 2)));
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(
                new MatchEventView(MATCH_ID, MATCH_UUID, "RUNNING", CLOCK, STORY_ID, USER_ID, null)));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(actor()));
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor()));
        when(store.findBackpack(anyLong(), anyLong()))
                .thenReturn(Optional.of(new BackpackStats(0, 0, 0)));
        when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(event()));
        when(store.findEventsById(STORY_ID))
                .thenReturn(Map.of(1L, event(), COMA_EVENT_ID, comaEvent()));
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of());
        when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.empty());
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.empty());
        when(store.findItemUuidsById(STORY_ID)).thenReturn(Map.of());
        when(store.findTraitUuidsById(STORY_ID)).thenReturn(Map.of());
        when(store.findLocationUuidsById(STORY_ID)).thenReturn(Map.of(LOC, "loc-here"));
        when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(ctx(new HashSet<>()));
        when(contentQueryPort.getCardByStoryIdAndCardId(eq(STORY_ID), anyInt(), anyString()))
                .thenAnswer(i -> card("card-" + i.getArgument(1)));
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    /** cos 10, energy 20/100, life 30/100, sad 0/50. */
    private static EventActorView actor() {
        return new EventActorView(CHAR_ID, "char-uuid", USER_ID, 50L, LOC,
                10, 10, 10, 20, 30, 0, 0, 100, 100, 50, false, false, null);
    }

    private static EventEntity event() {
        EventEntity e = new EventEntity();
        e.setId(1L);
        e.setUuid(EVENT_UUID);
        e.setType("NORMAL");
        e.setCostEnery(0);
        e.setCoinCost(0);
        e.setFlagEndTime(0);
        return e;
    }

    private static EventEntity comaEvent() {
        EventEntity e = new EventEntity();
        e.setId(COMA_EVENT_ID);
        e.setUuid("coma-event-uuid");
        e.setType("NORMAL");
        e.setIdCard(77);
        e.setCostEnery(0);
        e.setCoinCost(0);
        e.setFlagEndTime(0);
        return e;
    }

    private static EventCheckContext ctx(Set<Long> consumed) {
        return new EventCheckContext(CHAR_ID, LOC, false, false, 20, 10, 50L,
                new HashSet<>(), null, consumed, new HashMap<>());
    }

    private static CardInfo card(String title) {
        return new CardInfo(title, null, null, null, null, null, null, null, null, null,
                title, null, null, null, null);
    }

    private static EventEffectEntity stat(String statistic, int value) {
        EventEffectEntity e = new EventEffectEntity();
        e.setId(1L);
        e.setUuid("effect-uuid");
        e.setIdEvent(1);
        e.setStatistics(statistic);
        e.setValue(value);
        e.setTarget("ONLY_ONE");
        return e;
    }

    private void withEffects(EventEffectEntity... effects) {
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(1L, List.of(effects)));
    }

    /** Drop the only character to zero life — in single player that is the whole party. */
    private EventExecutionResult killTheParty() {
        withEffects(stat("life", -9999));
        return service.executeEvent(MATCH_UUID, USER_UUID, EVENT_UUID, "en");
    }

    // ── the happy path ──────────────────────────────────────────────────────

    @Test
    @DisplayName("Everyone down runs the story epilogue and keeps it out of the main chain")
    void epilogueRunsAndStaysSeparate() {
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.of(COMA_EVENT_ID));

        EventExecutionResult r = killTheParty();

        assertAll(
                () -> assertTrue(r.edgeState().allPlayersInComa()),
                () -> assertEquals(List.of("char-uuid"), r.edgeState().comaUuids()),
                () -> assertEquals("coma-event-uuid", r.edgeState().comaEventUuid()),
                () -> assertEquals("card-77", r.edgeState().comaEventCard().title()),
                () -> assertEquals(List.of("coma-event-uuid"),
                        r.edgeState().comaExecutedEventUuids()),
                () -> assertEquals(List.of(EVENT_UUID), r.executedEventUuids(),
                        "the player's own chain must not contain the epilogue"),
                () -> assertTrue(r.comaTriggered()),
                () -> assertTrue(r.refreshRecommended()));

        verify(edgeStore).setComa(MATCH_ID, CHAR_ID, CLOCK);
        verify(edgeStore).logEdgeState(eq(MATCH_ID), any(), eq(null), eq(CLOCK),
                contains(EdgeStateStorePort.MSG_ALL_PLAYER_COMA));
    }

    @Test
    @DisplayName("The match is NOT moved to GAMEOVER — that is step 59")
    void gameOverIsNotThisStep() {
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.of(COMA_EVENT_ID));

        assertFalse(killTheParty().gameOver());
    }

    // ── the early exits ─────────────────────────────────────────────────────

    @Test
    @DisplayName("A survivor means no epilogue at all")
    void survivorSkipsTheEpilogue() {
        EventActorView survivor = new EventActorView(30L, "mate-uuid", 20L, 51L, LOC,
                10, 10, 10, 20, 30, 0, 0, 100, 100, 50, false, false, null);
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(), survivor));
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.of(COMA_EVENT_ID));

        EventExecutionResult r = killTheParty();

        assertAll(
                () -> assertFalse(r.edgeState().allPlayersInComa()),
                () -> assertNull(r.edgeState().comaEventUuid()),
                () -> assertEquals(List.of("char-uuid"), r.edgeState().comaUuids()));
        verify(edgeStore, never()).logEdgeState(anyLong(), any(), any(), anyInt(),
                contains(EdgeStateStorePort.MSG_ALL_PLAYER_COMA));
    }

    @Test
    @DisplayName("An untouched character already in coma still counts as down")
    void untouchedComatoseCounts() {
        EventActorView alreadyDown = new EventActorView(30L, "mate-uuid", 20L, 51L, 999L,
                10, 10, 10, 20, 0, 0, 0, 100, 100, 50, true, true, null);
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(), alreadyDown));
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.of(COMA_EVENT_ID));

        assertTrue(killTheParty().edgeState().allPlayersInComa());
        // Reading isComa off the view must not drag the character into the flush.
        verify(store, never()).updateCharacterStats(eq(MATCH_ID), eq(30L), any());
        verify(store, never()).findBackpack(MATCH_ID, 30L);
    }

    @Test
    @DisplayName("A story with no authored epilogue still logs the collapse")
    void noAuthoredEpilogue() {
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.empty());

        EventExecutionResult r = killTheParty();

        assertTrue(r.edgeState().allPlayersInComa());
        assertNull(r.edgeState().comaEventUuid());
        verify(edgeStore).logEdgeState(eq(MATCH_ID), any(), eq(null), eq(CLOCK),
                contains(EdgeStateStorePort.MSG_ALL_PLAYER_COMA));
    }

    @Test
    @DisplayName("A dangling id_event_all_player_coma is authored noise, not an error")
    void danglingEpilogueId() {
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.of(999L));

        EventExecutionResult r = killTheParty();

        assertTrue(r.edgeState().allPlayersInComa());
        assertNull(r.edgeState().comaEventUuid());
    }

    @Test
    @DisplayName("A ONCE epilogue already spent does not fire again")
    void onceEpilogueStaysSpent() {
        EventEntity once = comaEvent();
        once.setType("ONCE");
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(1L, event(), COMA_EVENT_ID, once));
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.of(COMA_EVENT_ID));
        when(store.loadCheckContext(MATCH_ID, CHAR_ID))
                .thenReturn(ctx(new HashSet<>(Set.of(COMA_EVENT_ID))));

        EventExecutionResult r = killTheParty();

        assertTrue(r.edgeState().allPlayersInComa());
        assertNull(r.edgeState().comaEventUuid(), "spent once, spent for the whole match");
    }

    @Test
    @DisplayName("Nobody down at all leaves the edge state empty")
    void quietExecutionHasEmptyEdgeState() {
        withEffects(stat("life", -1));

        EventExecutionResult r = service.executeEvent(MATCH_UUID, USER_UUID, EVENT_UUID, "en");

        assertAll(
                () -> assertFalse(r.edgeState().anything()),
                () -> assertTrue(r.edgeState().comaUuids().isEmpty()),
                () -> assertTrue(r.edgeState().sadnessOverflowUuids().isEmpty()));
        verify(store, never()).findIdEventAllPlayerComa(anyLong());
    }

    @Test
    @DisplayName("The epilogue is resolved once, even when its own effects deepen the coma")
    void epilogueDoesNotReenter() {
        EventEntity epilogue = comaEvent();
        when(store.findEventsById(STORY_ID))
                .thenReturn(Map.of(1L, event(), COMA_EVENT_ID, epilogue));
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.of(COMA_EVENT_ID));
        EventEffectEntity epilogueHit = stat("life", -50);
        epilogueHit.setIdEvent((int) COMA_EVENT_ID);
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(
                1L, List.of(stat("life", -9999)),
                COMA_EVENT_ID, List.of(epilogueHit)));

        EventExecutionResult r = service.executeEvent(MATCH_UUID, USER_UUID, EVENT_UUID, "en");

        assertEquals("coma-event-uuid", r.edgeState().comaEventUuid());
        // One collapse, one row: re-entry would write a second.
        verify(edgeStore, times(1)).logEdgeState(eq(MATCH_ID), any(), eq(null), eq(CLOCK),
                contains(EdgeStateStorePort.MSG_ALL_PLAYER_COMA));
        verify(edgeStore, times(1)).setComa(MATCH_ID, CHAR_ID, CLOCK);
    }

    @Test
    @DisplayName("A sadness overflow that kills also runs the epilogue")
    void overflowCascadeReachesTheEpilogue() {
        // sad to the cap costs COS=10 life; start life at 8 so the hit empties the bar.
        EventActorView frail = new EventActorView(CHAR_ID, "char-uuid", USER_ID, 50L, LOC,
                10, 10, 10, 20, 8, 0, 0, 100, 100, 50, false, false, null);
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(frail));
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(frail));
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.of(COMA_EVENT_ID));
        withEffects(stat("sad", 9999));

        EventExecutionResult r = service.executeEvent(MATCH_UUID, USER_UUID, EVENT_UUID, "en");

        assertAll(
                () -> assertEquals(List.of("char-uuid"), r.edgeState().sadnessOverflowUuids()),
                () -> assertEquals(List.of("char-uuid"), r.edgeState().comaUuids()),
                () -> assertTrue(r.edgeState().allPlayersInComa()),
                () -> assertEquals("coma-event-uuid", r.edgeState().comaEventUuid()));
    }
}
