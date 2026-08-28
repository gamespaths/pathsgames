package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.TurnStatuses;
import games.paths.core.model.match.event.TimeAdvanced;
import games.paths.core.port.event.DomainEventPublisher;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.LocationEntryPort;
import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.TurnCyclePort.TurnCycleException;
import games.paths.core.port.match.TurnCycleStorePort;
import games.paths.core.port.match.TurnCycleStorePort.CharacterTurnView;
import games.paths.core.port.match.TurnCycleStorePort.ClockLabels;
import games.paths.core.port.match.TurnCycleStorePort.MatchView;
import games.paths.core.port.match.TurnCycleStorePort.QueueRow;
import games.paths.core.port.match.UserAccessPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@DisplayName("TimeAdvancementService")
class TimeAdvancementServiceTest {

    private TurnCycleStorePort store;
    private UserAccessPort userAccessPort;
    private DomainEventPublisher publisher;
    private TimeStartRecoveryService recoveryService;
    private TimeAdvancementService service;

    private static final String MATCH = "match-uuid";
    private static final String USER = "user-uuid";
    private static final long USER_ID = 7L;
    private static final long MATCH_ID = 1L;
    private static final long CHAR_ID = 10L;
    private static final String CHAR_UUID = "char-a";

    @BeforeEach
    void setUp() {
        store = mock(TurnCycleStorePort.class);
        userAccessPort = mock(UserAccessPort.class);
        publisher = mock(DomainEventPublisher.class);
        recoveryService = mock(TimeStartRecoveryService.class);
        when(recoveryService.applyAtTimeStart(anyLong()))
                .thenReturn(TimeStartRecoveryService.TimeStartOutcome.none());
        service = new TimeAdvancementService(store, userAccessPort, publisher, recoveryService);
        when(userAccessPort.findByUuid(USER)).thenReturn(
                Optional.of(new UserAccessPort.UserView(USER_ID, USER, "u", "PLAYER", 2)));
    }

    private MatchView match(String status, int clock) {
        return new MatchView(MATCH_ID, MATCH, status, clock, USER_ID, CHAR_ID);
    }

    private CharacterTurnView character(long id, String uuid, int energy, boolean sleeping) {
        return new CharacterTurnView(id, uuid, USER_ID, 5, 5, 5, 100, energy, sleeping);
    }

    // ── trigger logic ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("allCharactersDone")
    class Trigger {

        @Test
        @DisplayName("fires when every character is sleeping")
        void allSleeping() {
            assertTrue(TimeAdvancementService.allCharactersDone(List.of(
                    character(1, "a", 50, true), character(2, "b", 80, true))));
        }

        @Test
        @DisplayName("fires when every character has zero (or less) energy")
        void allZeroEnergy() {
            assertTrue(TimeAdvancementService.allCharactersDone(List.of(
                    character(1, "a", 0, false), character(2, "b", -3, false))));
        }

        @Test
        @DisplayName("does not fire when one character is awake with energy")
        void oneActive() {
            assertFalse(TimeAdvancementService.allCharactersDone(List.of(
                    character(1, "a", 50, true), character(2, "b", 80, false))));
        }

        @Test
        @DisplayName("does not fire on an empty character list")
        void empty() {
            assertFalse(TimeAdvancementService.allCharactersDone(List.of()));
        }
    }

    // ── sleep action ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("sleep")
    class Sleep {

        @Test
        @DisplayName("sets sleeping and, single-player, triggers time-end + advances clock")
        void sleepTriggersTimeEnd() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 3)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(CHAR_ID, CHAR_UUID, 50, false)));
            // After setting sleeping, the trigger sees a sleeping character.
            when(store.findCharactersByMatchId(MATCH_ID))
                    .thenReturn(List.of(character(CHAR_ID, CHAR_UUID, 50, true)));
            when(store.incrementMatchClock(MATCH_ID)).thenReturn(4);

            TimeAdvancementPort.SleepResult r = service.sleep(MATCH, USER);

            assertTrue(r.timeEndTriggered());
            assertEquals(4, r.currentClock());
            assertFalse(r.isSleeping()); // woke up at time start
            verify(store).setCharacterSleeping(MATCH_ID, CHAR_ID, true);
            verify(store).incrementMatchClock(MATCH_ID);
            verify(store).insertClockHistory(MATCH_ID, 4);
            verify(store).wakeAllCharacters(MATCH_ID);
            verify(store).replaceQueue(eq(MATCH_ID), anyList());
            verify(publisher, times(1)).publish(any(TimeAdvanced.class));
        }

        @Test
        @DisplayName("v0.35.6: the time-start's Step 30 verdict rides on the sleep answer")
        void sleepCarriesTheEdgeStateOfTheTimeStart() {
            LocationEntryPort runner = mock(LocationEntryPort.class);
            // The recovery emptied one bar; an event the same time-start fired emptied another.
            EventExecutionPort.EdgeStateOutcome fromRecovery =
                    new EventExecutionPort.EdgeStateOutcome(List.of(CHAR_UUID), List.of(), false,
                            null, null, List.of(), List.of());
            EventExecutionPort.EdgeStateOutcome fromEvent =
                    new EventExecutionPort.EdgeStateOutcome(List.of(), List.of(CHAR_UUID), true,
                            "coma-uuid", null, List.of("coma-uuid"), List.of());
            LocationEntryPort.PendingAutomaticEvent pending =
                    new LocationEntryPort.PendingAutomaticEvent(
                            LocationEntryPort.TRIGGER_COUNTER_ZERO, 12L, 340L, CHAR_ID, 0);
            LocationEntryPort.AutomaticEventFired fired =
                    new LocationEntryPort.AutomaticEventFired(
                            LocationEntryPort.TRIGGER_COUNTER_ZERO, 12L, "evt-fuse", null,
                            List.of(), List.of(), List.of(), false, fromEvent);
            when(recoveryService.applyAtTimeStart(MATCH_ID)).thenReturn(
                    new TimeStartRecoveryService.TimeStartOutcome(
                            List.of(), List.of(pending), fromRecovery));
            when(runner.runPendingAutomaticEvents(eq(MATCH_ID), eq(4), anyList(), any()))
                    .thenReturn(List.of(fired));
            service.setAutomaticEventRunner(runner);

            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 3)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(CHAR_ID, CHAR_UUID, 50, false)));
            when(store.findCharactersByMatchId(MATCH_ID))
                    .thenReturn(List.of(character(CHAR_ID, CHAR_UUID, 50, true)));
            when(store.incrementMatchClock(MATCH_ID)).thenReturn(4);

            TimeAdvancementPort.SleepResult r = service.sleep(MATCH, USER);

            // Both halves, one verdict: the sleeper is told what the whole time-start did.
            assertEquals(List.of(CHAR_UUID), r.edgeState().sadnessOverflowUuids());
            assertEquals(List.of(CHAR_UUID), r.edgeState().comaUuids());
            assertTrue(r.edgeState().allPlayersInComa());
            assertEquals("coma-uuid", r.edgeState().comaEventUuid());
        }

        @Test
        @DisplayName("v0.35.6: a sleep that triggers nothing answers an empty edge state")
        void sleepWithoutATimeEndAnswersAnEmptyEdgeState() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 3)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(CHAR_ID, CHAR_UUID, 50, false)));
            // A second character still awake: no time end, so no recovery and no verdict.
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(
                    character(CHAR_ID, CHAR_UUID, 50, true),
                    character(99L, "other-uuid", 50, false)));

            TimeAdvancementPort.SleepResult r = service.sleep(MATCH, USER);

            assertFalse(r.timeEndTriggered());
            assertNotNull(r.edgeState());
            assertFalse(r.edgeState().anything());
        }

        @Test
        @DisplayName("Step 33: the events the time-start collected are run, and told to the sleeper")
        void sleepRunsAndReportsTheAutomaticEvents() {
            LocationEntryPort runner = mock(LocationEntryPort.class);
            LocationEntryPort.PendingAutomaticEvent pending =
                    new LocationEntryPort.PendingAutomaticEvent(
                            LocationEntryPort.TRIGGER_COUNTER_ZERO, 12L, 340L, CHAR_ID, 0);
            LocationEntryPort.AutomaticEventFired fired =
                    new LocationEntryPort.AutomaticEventFired(
                            LocationEntryPort.TRIGGER_COUNTER_ZERO, 12L, "evt-fuse", null,
                            List.of(), List.of(), List.of(), false);
            when(recoveryService.applyAtTimeStart(MATCH_ID)).thenReturn(
                    new TimeStartRecoveryService.TimeStartOutcome(List.of(), List.of(pending)));
            when(runner.runPendingAutomaticEvents(eq(MATCH_ID), eq(4), anyList(), any()))
                    .thenReturn(List.of(fired));
            when(runner.describeForRecipient(eq(MATCH_ID), eq(CHAR_ID), eq(4), anyList(), any()))
                    .thenReturn(List.<TimeAdvancementPort.CounterZeroItem>of(
                            new TimeAdvancementPort.CounterZeroItem(
                                    LocationEntryPort.TRIGGER_COUNTER_ZERO, 12L, null, null,
                                    List.of(), "evt-fuse", 4,
                                    TimeAdvancementPort.CounterZeroItem.VISIBILITY_NAMED)));
            service.setAutomaticEventRunner(runner);

            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 3)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(CHAR_ID, CHAR_UUID, 50, false)));
            when(store.findCharactersByMatchId(MATCH_ID))
                    .thenReturn(List.of(character(CHAR_ID, CHAR_UUID, 50, true)));
            when(store.incrementMatchClock(MATCH_ID)).thenReturn(4);

            TimeAdvancementPort.SleepResult r = service.sleep(MATCH, USER);

            assertEquals(1, r.counterZero().size());
            assertEquals("evt-fuse", r.counterZero().get(0).eventUuid());
            assertEquals(TimeAdvancementPort.CounterZeroItem.VISIBILITY_NAMED,
                    r.counterZero().get(0).visibility());
        }

        @Test
        @DisplayName("Step 33: no runner wired means no automatic events, exactly as before")
        void noRunnerMeansNoCounterZero() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 3)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(CHAR_ID, CHAR_UUID, 50, false)));
            when(store.findCharactersByMatchId(MATCH_ID))
                    .thenReturn(List.of(character(CHAR_ID, CHAR_UUID, 50, true)));
            when(store.incrementMatchClock(MATCH_ID)).thenReturn(4);

            assertTrue(service.sleep(MATCH, USER).counterZero().isEmpty());
        }

        @Test
        @DisplayName("does not advance the clock when not all characters are done")
        void sleepNoTrigger() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 3)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(CHAR_ID, CHAR_UUID, 50, false)));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(
                    character(CHAR_ID, CHAR_UUID, 50, true),
                    character(20L, "char-b", 90, false))); // another player still awake

            TimeAdvancementPort.SleepResult r = service.sleep(MATCH, USER);

            assertFalse(r.timeEndTriggered());
            assertEquals(3, r.currentClock());
            assertTrue(r.isSleeping());
            verify(store).setCharacterSleeping(MATCH_ID, CHAR_ID, true);
            verify(store, never()).incrementMatchClock(anyLong());
            verify(publisher, never()).publish(any());
        }

        @Test
        @DisplayName("rebuilds the queue with highest priority ACTIVE and rest WAITING on time-end")
        void rebuildQueueOnTimeEnd() {
            CharacterTurnView a = new CharacterTurnView(1L, "a", USER_ID, 9, 9, 9, 100, 0, true);
            CharacterTurnView b = new CharacterTurnView(2L, "b", USER_ID, 1, 1, 1, 100, 0, true);
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 0)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(a));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(a, b));
            when(store.incrementMatchClock(MATCH_ID)).thenReturn(1);

            service.sleep(MATCH, USER);

            ArgumentCaptor<List<QueueRow>> captor = ArgumentCaptor.forClass(List.class);
            verify(store).replaceQueue(eq(MATCH_ID), captor.capture());
            List<QueueRow> rows = captor.getValue();
            assertEquals(2, rows.size());
            assertEquals(TurnStatuses.ACTIVE, rows.get(0).status());
            assertEquals(1L, rows.get(0).idCharacterMatch()); // higher priority
            assertEquals(TurnStatuses.WAITING, rows.get(1).status());
            assertEquals(1, rows.get(0).clock());
            verify(store).updateMatchStatusAndTurn(MATCH_ID, MatchStatuses.RUNNING, 1L);
        }

        @Test
        @DisplayName("MATCH_NOT_RUNNING when the match is not RUNNING")
        void notRunning() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.CREATED, 0)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(CHAR_ID, CHAR_UUID, 50, false)));
            assertCode(TurnCycleException.Code.MATCH_NOT_RUNNING, () -> service.sleep(MATCH, USER));
        }

        @Test
        @DisplayName("MATCH_NOT_FOUND when the match does not exist")
        void matchNotFound() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.empty());
            assertCode(TurnCycleException.Code.MATCH_NOT_FOUND, () -> service.sleep(MATCH, USER));
        }

        @Test
        @DisplayName("MATCH_NOT_FOUND when the caller owns no character in the match")
        void notAParticipant() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 0)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            assertCode(TurnCycleException.Code.MATCH_NOT_FOUND, () -> service.sleep(MATCH, USER));
        }
    }

    // ── clock query ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("clock")
    class Clock {

        @Test
        @DisplayName("returns clock, labels and per-character sleeping/energy state")
        void clockPayload() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 5)));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(
                    character(CHAR_ID, CHAR_UUID, 40, true)));
            when(store.findStoryClockLabels(MATCH_ID, "en")).thenReturn(new ClockLabels("hour", "hours"));

            TimeAdvancementPort.ClockResult r = service.clock(MATCH, USER);

            assertEquals(5, r.currentClock());
            assertEquals("hour", r.clockLabelSingular());
            assertEquals("hours", r.clockLabelPlural());
            assertTrue(r.anyCharacterSleeping());
            assertEquals(1, r.characters().size());
            assertEquals(40, r.characters().get(0).energy());
            assertTrue(r.characters().get(0).isSleeping());
        }

        @Test
        @DisplayName("MATCH_NOT_FOUND when the caller is not the match creator")
        void notOwner() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(
                    new MatchView(MATCH_ID, MATCH, MatchStatuses.RUNNING, 0, 999L, CHAR_ID)));
            assertCode(TurnCycleException.Code.MATCH_NOT_FOUND, () -> service.clock(MATCH, USER));
        }

        @Test
        @DisplayName("clockForAdmin returns the same payload without an owning user")
        void clockForAdminPayload() {
            // No userAccessPort.findByUuid stubbing and a non-matching creator: the
            // admin read skips the participation check entirely.
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(
                    new MatchView(MATCH_ID, MATCH, MatchStatuses.RUNNING, 5, 999L, CHAR_ID)));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(
                    character(CHAR_ID, CHAR_UUID, 40, true)));
            when(store.findStoryClockLabels(MATCH_ID, "en")).thenReturn(new ClockLabels("hour", "hours"));

            TimeAdvancementPort.ClockResult r = service.clockForAdmin(MATCH);

            assertEquals(5, r.currentClock());
            assertEquals("hour", r.clockLabelSingular());
            assertTrue(r.anyCharacterSleeping());
            assertEquals(1, r.characters().size());
            assertEquals(40, r.characters().get(0).energy());
        }

        @Test
        @DisplayName("clockForAdmin throws MATCH_NOT_FOUND for an unknown match")
        void clockForAdminNotFound() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.empty());
            assertCode(TurnCycleException.Code.MATCH_NOT_FOUND, () -> service.clockForAdmin(MATCH));
        }
    }

    private static void assertCode(TurnCycleException.Code expected, Runnable action) {
        TurnCycleException ex = assertThrows(TurnCycleException.class, action::run);
        assertEquals(expected, ex.getCode());
    }
}
