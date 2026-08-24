package games.paths.core.service.match;

import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.EventExecutionStorePort.EventActorView;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.EventExecutionStorePort.MatchEventView;
import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * EventExecutionService (Step 29) — the {@code id_event_next} chain, {@code flag_end_time},
 * and the ONCE invariant.
 */
@DisplayName("EventExecutionService chain (Step 29)")
class EventExecutionServiceChainTest {

    private static final String MATCH_UUID = "match-uuid";
    private static final String USER_UUID = "user-uuid";
    private static final long MATCH_ID = 1L;
    private static final long USER_ID = 2L;
    private static final long CHAR_ID = 3L;
    private static final long STORY_ID = 4L;
    private static final long LOC = 100L;

    private EventExecutionStorePort store;
    private EdgeStateStorePort edgeStore;
    private TimeAdvancementService timeAdvancementService;
    private EventExecutionService service;
    private EventCheckContext ctx;

    @BeforeEach
    void setUp() {
        store = mock(EventExecutionStorePort.class);
        edgeStore = mock(EdgeStateStorePort.class);
        UserAccessPort userAccessPort = mock(UserAccessPort.class);
        ContentQueryPort contentQueryPort = mock(ContentQueryPort.class);
        timeAdvancementService = mock(TimeAdvancementService.class);
        service = new EventExecutionService(store, edgeStore, userAccessPort, contentQueryPort, timeAdvancementService);
        ctx = ctx();

        when(userAccessPort.findByUuid(USER_UUID)).thenReturn(Optional.of(
                new UserAccessPort.UserView(USER_ID, USER_UUID, "player", "USER", 2)));
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(
                new MatchEventView(MATCH_ID, MATCH_UUID, "RUNNING", 7, STORY_ID, USER_ID, null)));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(actor()));
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor()));
        when(store.findBackpack(anyLong(), anyLong()))
                .thenReturn(Optional.of(new BackpackStats(5, 5, 10)));
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of());
        when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.empty());
        when(store.findItemUuidsById(STORY_ID)).thenReturn(Map.of());
        when(store.findTraitUuidsById(STORY_ID)).thenReturn(Map.of());
        when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(ctx);
        when(timeAdvancementService.forceTimeEnd(MATCH_UUID))
                .thenReturn(new TimeAdvancementService.TimeEndOutcome(8, List.<TimeAdvancementPort.RecoveryItem>of(), List.of()));
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static EventActorView actor() {
        return new EventActorView(CHAR_ID, "char-uuid", USER_ID, 50L, LOC,
                10, 10, 10, 20, 30, 0, 0, 100, 100, 50, 30, false, false, null);
    }

    private static EventCheckContext ctx() {
        return new EventCheckContext(CHAR_ID, LOC, false, false, 20, 10, 5, 5, 50L,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }

    private static EventEntity ev(long id, Integer next) {
        EventEntity e = new EventEntity();
        e.setId(id);
        e.setUuid("event-" + id);
        e.setType("NORMAL");
        e.setCostEnery(0);
        e.setCostCoin(0);
        e.setFlagEndTime(0);
        e.setIdEventNext(next);
        return e;
    }

    /** Register a whole chain: the first event is the one the endpoint receives. */
    private void chain(EventEntity... events) {
        Map<Long, EventEntity> byId = new HashMap<>();
        for (EventEntity e : events) {
            byId.put(e.getId(), e);
        }
        when(store.findEventsById(STORY_ID)).thenReturn(byId);
        when(store.findEventByStoryAndUuid(STORY_ID, events[0].getUuid()))
                .thenReturn(Optional.of(events[0]));
    }

    private EventExecutionResult execute(EventEntity first) {
        return service.executeEvent(MATCH_UUID, USER_UUID, first.getUuid(), "en");
    }

    private static EventEffectEntity expEffect(long id, long idEvent, int value) {
        EventEffectEntity e = new EventEffectEntity();
        e.setId(id);
        e.setIdEvent((int) idEvent);
        e.setStatistics("exp");
        e.setValue(value);
        e.setTarget("ONLY_ONE");
        return e;
    }

    // ── walking the chain ───────────────────────────────────────────────────

    @Nested
    @DisplayName("Walking")
    class Walking {

        @Test
        @DisplayName("A three-event chain runs in order and logs each event once")
        void threeEvents() {
            EventEntity a = ev(1L, 2);
            EventEntity b = ev(2L, 3);
            EventEntity c = ev(3L, null);
            chain(a, b, c);

            EventExecutionResult r = execute(a);

            assertEquals(List.of("event-1", "event-2", "event-3"), r.executedEventUuids());
            verify(store).logEventExecuted(eq(MATCH_ID), eq(CHAR_ID), eq(1L), anyInt(), anyString(), any());
            verify(store).logEventExecuted(eq(MATCH_ID), eq(CHAR_ID), eq(2L), anyInt(), anyString(), any());
            verify(store).logEventExecuted(eq(MATCH_ID), eq(CHAR_ID), eq(3L), anyInt(), anyString(), any());
        }

        @Test
        @DisplayName("v0.35.3: only the event the player asked for carries the price")
        void onlyTheOpeningEventIsBilled() {
            EventEntity a = ev(1L, 2);
            a.setCostEnery(4);
            a.setCostCoin(1);
            a.setCostFood(2);
            a.setCostMagic(3);
            EventEntity b = ev(2L, null);
            chain(a, b);

            execute(a);

            verify(store).logEventExecuted(eq(MATCH_ID), any(), eq(1L), anyInt(), anyString(),
                    eq(new EventExecutionStorePort.SpentResources(4, 2, 3, 1)));
            // The chained event is not something the player asked for: its row logs nothing,
            // so summing a match's rows gives what was really spent, not the price repeated.
            verify(store).logEventExecuted(eq(MATCH_ID), any(), eq(2L), anyInt(), anyString(),
                    eq(EventExecutionStorePort.SpentResources.none()));
        }

        @Test
        @DisplayName("Effects of every event in the chain are applied and compound")
        void effectsCompound() {
            EventEntity a = ev(1L, 2);
            EventEntity b = ev(2L, null);
            chain(a, b);
            when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(
                    1L, List.of(expEffect(1L, 1L, 3)),
                    2L, List.of(expEffect(2L, 2L, 4))));

            EventExecutionResult r = execute(a);

            assertEquals(2, r.statChanges().size());
            assertEquals(7, r.statChanges().get(1).after(), "exp accumulates across the chain");
        }

        @Test
        @DisplayName("A dangling idEventNext stops the chain cleanly")
        void danglingNext() {
            EventEntity a = ev(1L, 999);
            chain(a);

            EventExecutionResult r = execute(a);

            assertEquals(List.of("event-1"), r.executedEventUuids());
        }

        @Test
        @DisplayName("An authored cycle A -> B -> A terminates, each event running once")
        void cycle() {
            EventEntity a = ev(1L, 2);
            EventEntity b = ev(2L, 1); // back to A — the admin CRUD path is lenient enough to allow it
            chain(a, b);

            EventExecutionResult r = execute(a);

            assertEquals(List.of("event-1", "event-2"), r.executedEventUuids());
            verify(store, times(1)).logEventExecuted(eq(MATCH_ID), any(), eq(1L), anyInt(), anyString(), any());
            verify(store, times(1)).logEventExecuted(eq(MATCH_ID), any(), eq(2L), anyInt(), anyString(), any());
        }

        @Test
        @DisplayName("A chain longer than the depth bound stops instead of running away")
        void depthBound() {
            EventEntity[] events = new EventEntity[40];
            for (int i = 0; i < 40; i++) {
                events[i] = ev(i + 1L, i + 2); // the last one points at a non-existent 41
            }
            chain(events);

            EventExecutionResult r = execute(events[0]);

            assertEquals(32, r.executedEventUuids().size(), "the chain is bounded at MAX_CHAIN");
        }
    }

    // ── chained events are consequences, not choices ────────────────────────

    @Nested
    @DisplayName("Chained events")
    class Chained {

        @Test
        @DisplayName("A chained event is not re-checked: its own conditions do not stop it")
        void notRechecked() {
            EventEntity a = ev(1L, 2);
            EventEntity b = ev(2L, null);
            b.setIdSpecificLocation(999);       // the actor is not there
            b.setIdClassCondition(999);         // and has the wrong class
            b.setRegistryKeyCondition("GATE");  // and the gate is shut
            b.setRegistryValueCondition("OPEN");
            chain(a, b);

            EventExecutionResult r = execute(a);

            assertEquals(List.of("event-1", "event-2"), r.executedEventUuids());
        }

        @Test
        @DisplayName("A chained event costs nothing: the player paid once, to start the chain")
        void costsNothing() {
            EventEntity a = ev(1L, 2);
            a.setCostEnery(5);
            a.setCostCoin(2);
            EventEntity b = ev(2L, null);
            b.setCostEnery(9999);
            b.setCostCoin(9999);
            chain(a, b);

            EventExecutionResult r = execute(a);

            assertEquals(5, r.energySpent());
            assertEquals(2, r.coinSpent());
            assertEquals(15, r.newEnergy());
            assertEquals(8, r.newCoin());
        }

        @Test
        @DisplayName("A ONCE event already spent stops the chain before it")
        void spentOnceStopsTheChain() {
            EventEntity a = ev(1L, 2);
            EventEntity b = ev(2L, null);
            b.setType("ONCE");
            chain(a, b);
            ctx.consumedEventIds().add(2L);

            EventExecutionResult r = execute(a);

            assertEquals(List.of("event-1"), r.executedEventUuids());
            verify(store, never()).logEventExecuted(anyLong(), any(), eq(2L), anyInt(), anyString(), any());
        }

        @Test
        @DisplayName("A ONCE event reached twice in one chain runs only the first time")
        void onceWithinTheSameChain() {
            EventEntity a = ev(1L, 2);
            EventEntity b = ev(2L, 1); // loops back to A
            b.setType("ONCE");
            chain(a, b);

            EventExecutionResult r = execute(a);

            assertEquals(List.of("event-1", "event-2"), r.executedEventUuids());
        }
    }

    // ── flag_end_time ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("Time end")
    class TimeEnd {

        @Test
        @DisplayName("flag_end_time forces a time end once, after the whole chain")
        void afterTheChain() {
            EventEntity a = ev(1L, 2);
            EventEntity b = ev(2L, 3);
            b.setFlagEndTime(1);
            EventEntity c = ev(3L, null);
            chain(a, b, c);

            EventExecutionResult r = execute(a);

            assertEquals(List.of("event-1", "event-2", "event-3"), r.executedEventUuids(),
                    "the chain completes before time advances");
            verify(timeAdvancementService, times(1)).forceTimeEnd(MATCH_UUID);
            assertTrue(r.timeEnded());
            assertTrue(r.forcedSleep());
            assertEquals(8, r.currentClock(), "the response carries the NEW clock");
            assertTrue(r.refreshRecommended());
        }

        @Test
        @DisplayName("Two events with flag_end_time still advance time only once")
        void onlyOnce() {
            EventEntity a = ev(1L, 2);
            a.setFlagEndTime(1);
            EventEntity b = ev(2L, null);
            b.setFlagEndTime(1);
            chain(a, b);

            execute(a);

            verify(timeAdvancementService, times(1)).forceTimeEnd(MATCH_UUID);
        }

        @Test
        @DisplayName("Without flag_end_time time does not move")
        void noFlagNoAdvance() {
            EventEntity a = ev(1L, null);
            chain(a);

            EventExecutionResult r = execute(a);

            verify(timeAdvancementService, never()).forceTimeEnd(anyString());
            assertFalse(r.timeEnded());
            assertEquals(7, r.currentClock());
        }
    }

    // ── the ONCE invariant depends on the log marker ────────────────────────

    @Nested
    @DisplayName("ONCE bookkeeping")
    class Once {

        @Test
        @DisplayName("Executing an event stamps the EVENT_EXECUTED marker the ONCE check reads")
        void marker() {
            EventEntity a = ev(1L, null);
            a.setType("ONCE");
            chain(a);

            execute(a);

            verify(store).logEventExecuted(eq(MATCH_ID), eq(CHAR_ID), eq(1L), eq(7),
                    startsWith(EventExecutionStorePort.MSG_EVENT_EXECUTED), any());
        }

        @Test
        @DisplayName("A ONCE event merely REFERENCED by a weather or counter-zero log stays available")
        void referencedIsNotConsumed() {
            // Regression guard. logCounterZero (Step 26) and logWeatherEvent (Step 27) write
            // log_events rows carrying id_event for events that never ran. The store builds
            // consumedEventIds from the EVENT_EXECUTED marker alone, so such a row must not
            // burn the event — here the context simply reports it as not consumed.
            EventEntity a = ev(1L, null);
            a.setType("ONCE");
            chain(a);
            assertTrue(ctx.consumedEventIds().isEmpty(),
                    "a referenced-but-never-executed event is not in the consumed set");

            assertDoesNotThrow(() -> execute(a));
        }
    }
}
