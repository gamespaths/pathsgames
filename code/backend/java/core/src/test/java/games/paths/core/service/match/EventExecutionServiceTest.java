package games.paths.core.service.match;

import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException.Code;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.EventExecutionStorePort.CharacterStats;
import games.paths.core.port.match.EventExecutionStorePort.EventActorView;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.EventExecutionStorePort.MatchEventView;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * EventExecutionService (Step 29) — resolution, validation, costs and the response contract.
 *
 * <p>The effect matrix lives in {@code EventExecutionServiceEffectsTest} and the chain in
 * {@code EventExecutionServiceChainTest}.</p>
 */
@DisplayName("EventExecutionService (Step 29)")
class EventExecutionServiceTest {

    private static final String MATCH_UUID = "match-uuid";
    private static final String USER_UUID = "user-uuid";
    private static final String EVENT_UUID = "event-uuid";
    private static final long MATCH_ID = 1L;
    private static final long USER_ID = 2L;
    private static final long CHAR_ID = 3L;
    private static final long STORY_ID = 4L;
    private static final long LOC = 100L;

    private EventExecutionStorePort store;
    private UserAccessPort userAccessPort;
    private ContentQueryPort contentQueryPort;
    private TimeAdvancementService timeAdvancementService;
    private EventExecutionService service;

    @BeforeEach
    void setUp() {
        store = mock(EventExecutionStorePort.class);
        userAccessPort = mock(UserAccessPort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        timeAdvancementService = mock(TimeAdvancementService.class);
        service = new EventExecutionService(store, userAccessPort, contentQueryPort, timeAdvancementService);

        when(userAccessPort.findByUuid(USER_UUID)).thenReturn(Optional.of(
                new UserAccessPort.UserView(USER_ID, USER_UUID, "player", "USER", 2)));
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(match("RUNNING")));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(actor()));
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor()));
        when(store.findBackpack(MATCH_ID, CHAR_ID)).thenReturn(Optional.of(new BackpackStats(5, 5, 10)));
        when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(event()));
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(1L, event()));
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of());
        when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.empty());
        when(store.findItemUuidsById(STORY_ID)).thenReturn(Map.of());
        when(store.findTraitUuidsById(STORY_ID)).thenReturn(Map.of());
        when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(ctx());
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static MatchEventView match(String status) {
        return new MatchEventView(MATCH_ID, MATCH_UUID, status, 7, STORY_ID, USER_ID, null);
    }

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

    private static EventCheckContext ctx() {
        return new EventCheckContext(CHAR_ID, LOC, false, false, 20, 10, 50L,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }

    private EventExecutionResult execute() {
        return service.executeEvent(MATCH_UUID, USER_UUID, EVENT_UUID, "en");
    }

    private static Code codeOf(Executable body) {
        EventExecutionException ex = assertThrows(EventExecutionException.class, body::run);
        return ex.getCode();
    }

    private interface Executable {
        void run();
    }

    // ── resolution ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Resolution")
    class Resolution {

        @Test
        @DisplayName("An unknown user is masked as MATCH_NOT_FOUND")
        void unknownUser() {
            when(userAccessPort.findByUuid("nobody")).thenReturn(Optional.empty());
            assertEquals(Code.MATCH_NOT_FOUND,
                    codeOf(() -> service.executeEvent(MATCH_UUID, "nobody", EVENT_UUID, "en")));
        }

        @Test
        @DisplayName("An unknown match is MATCH_NOT_FOUND")
        void unknownMatch() {
            when(store.findMatchByUuid("nope")).thenReturn(Optional.empty());
            assertEquals(Code.MATCH_NOT_FOUND,
                    codeOf(() -> service.executeEvent("nope", USER_UUID, EVENT_UUID, "en")));
        }

        @Test
        @DisplayName("A user with no character in the match is masked as MATCH_NOT_FOUND")
        void notAParticipant() {
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            assertEquals(Code.MATCH_NOT_FOUND, codeOf(EventExecutionServiceTest.this::execute));
        }

        @Test
        @DisplayName("MATCH_NOT_RUNNING for any status other than RUNNING")
        void notRunning() {
            for (String status : List.of("CREATED", "PAUSED", "ENDED", "GAMEOVER")) {
                when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(match(status)));
                assertEquals(Code.MATCH_NOT_RUNNING, codeOf(EventExecutionServiceTest.this::execute),
                        "status " + status);
            }
        }

        @Test
        @DisplayName("EVENT_NOT_FOUND when the story has no such event")
        void unknownEvent() {
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.empty());
            assertEquals(Code.EVENT_NOT_FOUND, codeOf(EventExecutionServiceTest.this::execute));
        }
    }

    // ── the check procedure is the gate ─────────────────────────────────────

    @Nested
    @DisplayName("Check procedure")
    class Check {

        @Test
        @DisplayName("Every rejection of the checker surfaces as its own code")
        void rejectionsSurface() {
            // The checker is exhaustively unit-tested on its own; here we prove the service
            // delegates to it and propagates the reason verbatim.
            EventEntity e = event();
            e.setType("ONCE");
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(e));
            when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenAnswer(i -> {
                EventCheckContext c = ctx();
                c.consumedEventIds().add(1L);
                return c;
            });
            assertEquals(Code.ONCE_ALREADY_CONSUMED, codeOf(EventExecutionServiceTest.this::execute));
        }

        @Test
        @DisplayName("NOT_ENOUGH_ENERGY leaves the character untouched")
        void rejectionWritesNothing() {
            EventEntity e = event();
            e.setCostEnery(999);
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(e));

            assertEquals(Code.NOT_ENOUGH_ENERGY, codeOf(EventExecutionServiceTest.this::execute));
            verify(store, never()).updateCharacterStats(anyLong(), anyLong(), any());
            verify(store, never()).logEventExecuted(anyLong(), any(), anyLong(), anyInt(), anyString());
        }

        @Test
        @DisplayName("A sleeping character cannot act")
        void sleeping() {
            when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(
                    new EventCheckContext(CHAR_ID, LOC, true, false, 20, 10, 50L,
                            new HashSet<>(), null, new HashSet<>(), new HashMap<>()));
            assertEquals(Code.CHARACTER_CANNOT_ACT, codeOf(EventExecutionServiceTest.this::execute));
        }
    }

    // ── costs ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Costs")
    class Costs {

        @Test
        @DisplayName("Energy and coins are deducted and reported")
        void deducted() {
            EventEntity e = event();
            e.setCostEnery(5);
            e.setCoinCost(3);
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(e));

            EventExecutionResult r = execute();

            assertEquals(5, r.energySpent());
            assertEquals(3, r.coinSpent());
            assertEquals(15, r.newEnergy());   // 20 - 5
            assertEquals(7, r.newCoin());      // 10 - 3

            ArgumentCaptorHolder h = capture();
            assertEquals(15, h.stats.energy());
            assertEquals(7, h.backpack.coin());
        }

        @Test
        @DisplayName("A free event writes no backpack row")
        void freeEventLeavesBackpackAlone() {
            execute();
            verify(store, never()).updateBackpack(anyLong(), anyLong(), any());
        }

        @Test
        @DisplayName("The backpack starts from the real food/magic, never from zero")
        void backpackNotZeroed() {
            EventEntity e = event();
            e.setCoinCost(1);
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(e));

            execute();

            ArgumentCaptorHolder h = capture();
            assertEquals(5, h.backpack.food(), "food must survive a coin-only change");
            assertEquals(5, h.backpack.magic(), "magic must survive a coin-only change");
            assertEquals(9, h.backpack.coin());
        }
    }

    // ── the turn queue is never touched (decision D4) ───────────────────────

    @Nested
    @DisplayName("Turns")
    class Turns {

        @Test
        @DisplayName("turnConsumed is always false — execute-event never touches the turn queue")
        void turnNeverConsumed() {
            assertFalse(execute().turnConsumed());
        }
    }

    // ── result contract ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("Result")
    class Result {

        @Test
        @DisplayName("A no-op event reports no change and no refresh")
        void noChange() {
            EventExecutionResult r = execute();

            assertAll(
                    () -> assertEquals(MATCH_UUID, r.matchUuid()),
                    () -> assertEquals(EVENT_UUID, r.eventUuid()),
                    () -> assertEquals("NORMAL", r.eventType()),
                    () -> assertEquals(List.of(EVENT_UUID), r.executedEventUuids()),
                    () -> assertEquals(7, r.currentClock()),
                    () -> assertFalse(r.timeEnded()),
                    () -> assertFalse(r.comaTriggered()),
                    () -> assertFalse(r.gameOver()),
                    () -> assertFalse(r.refreshRecommended()),
                    () -> assertTrue(r.pendingChoices().isEmpty(), "Step 30 fills pendingChoices"));
        }

        @Test
        @DisplayName("Any state change sets refreshRecommended")
        void refreshOnChange() {
            when(store.findEffectsByEventId(STORY_ID))
                    .thenReturn(Map.of(1L, List.of(statEffect("life", -1))));
            EventExecutionResult r = execute();
            assertTrue(r.refreshRecommended());
            assertEquals(1, r.statChanges().size());
        }

        @Test
        @DisplayName("gameOver is reported when the event is the story's end-game event")
        void gameOverFlag() {
            when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.of(1L));
            EventExecutionResult r = execute();
            assertTrue(r.gameOver());
            assertTrue(r.refreshRecommended());
        }

        @Test
        @DisplayName("The event is logged once, with the EVENT_EXECUTED marker")
        void logged() {
            execute();
            verify(store).logEventExecuted(eq(MATCH_ID), eq(CHAR_ID), eq(1L), eq(7),
                    startsWith(EventExecutionStorePort.MSG_EVENT_EXECUTED));
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static EventEffectEntity statEffect(String stat, int value) {
        EventEffectEntity e = new EventEffectEntity();
        e.setId(1L);
        e.setIdEvent(1);
        e.setStatistics(stat);
        e.setValue(value);
        e.setTarget("ONLY_ONE");
        return e;
    }

    private record ArgumentCaptorHolder(CharacterStats stats, BackpackStats backpack) {
    }

    /** The stats and backpack the service wrote back, or nulls when it wrote none. */
    private ArgumentCaptorHolder capture() {
        List<CharacterStats> stats = new ArrayList<>();
        List<BackpackStats> backpacks = new ArrayList<>();
        org.mockito.ArgumentCaptor<CharacterStats> sc =
                org.mockito.ArgumentCaptor.forClass(CharacterStats.class);
        org.mockito.ArgumentCaptor<BackpackStats> bc =
                org.mockito.ArgumentCaptor.forClass(BackpackStats.class);
        verify(store, atLeast(0)).updateCharacterStats(anyLong(), anyLong(), sc.capture());
        verify(store, atLeast(0)).updateBackpack(anyLong(), anyLong(), bc.capture());
        stats.addAll(sc.getAllValues());
        backpacks.addAll(bc.getAllValues());
        return new ArgumentCaptorHolder(
                stats.isEmpty() ? null : stats.get(stats.size() - 1),
                backpacks.isEmpty() ? null : backpacks.get(backpacks.size() - 1));
    }
}
