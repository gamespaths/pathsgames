package games.paths.core.service.match;

import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException.Code;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionPort.PendingChoice;
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

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * EventExecutionService choices (Step 31) — the CHOICES_PENDING branch.
 *
 * <p>What opening a choice-event does (pay, mark, present) and everything it deliberately
 * does not (effects, chain, flag_end_time, edge states, gameOver), plus the idempotent
 * re-fetch of an open cycle. The per-option verdict matrix lives in
 * {@code ChoiceAvailabilityCheckerTest}; here only its wiring is exercised.</p>
 */
@DisplayName("EventExecutionService choices (Step 31)")
class EventExecutionServiceChoicesTest {

    private static final String MATCH_UUID = "match-uuid";
    private static final String USER_UUID = "user-uuid";
    private static final String EVENT_UUID = "event-uuid";
    private static final long MATCH_ID = 1L;
    private static final long USER_ID = 2L;
    private static final long CHAR_ID = 3L;
    private static final long STORY_ID = 4L;
    private static final long LOC = 100L;
    private static final long EVENT_ID = 1L;

    private EventExecutionStorePort store;
    private EdgeStateStorePort edgeStore;
    private UserAccessPort userAccessPort;
    private ContentQueryPort contentQueryPort;
    private TimeAdvancementService timeAdvancementService;
    private EventExecutionService service;

    @BeforeEach
    void setUp() {
        store = mock(EventExecutionStorePort.class);
        edgeStore = mock(EdgeStateStorePort.class);
        userAccessPort = mock(UserAccessPort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        timeAdvancementService = mock(TimeAdvancementService.class);
        service = new EventExecutionService(store, edgeStore, userAccessPort, contentQueryPort, timeAdvancementService);

        when(userAccessPort.findByUuid(USER_UUID)).thenReturn(Optional.of(
                new UserAccessPort.UserView(USER_ID, USER_UUID, "player", "USER", 2)));
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(match()));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(actor()));
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor()));
        when(store.findBackpack(MATCH_ID, CHAR_ID)).thenReturn(Optional.of(new BackpackStats(5, 5, 10)));
        when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(event()));
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event()));
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of());
        when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.empty());
        when(store.findItemUuidsById(STORY_ID)).thenReturn(Map.of());
        when(store.findTraitUuidsById(STORY_ID)).thenReturn(Map.of());
        when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(ctx());
        when(store.findChoicesByEventId(STORY_ID, EVENT_ID)).thenReturn(List.of());
        when(store.findChoiceConditionsByChoiceId(STORY_ID)).thenReturn(Map.of());
        when(store.findTraitIdsByCharacter(MATCH_ID, CHAR_ID)).thenReturn(Set.of());
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static MatchEventView match() {
        return new MatchEventView(MATCH_ID, MATCH_UUID, "RUNNING", 7, STORY_ID, USER_ID, null);
    }

    private static EventActorView actor() {
        return new EventActorView(CHAR_ID, "char-uuid", USER_ID, 50L, LOC,
                10, 10, 10, 20, 30, 0, 0, 100, 100, 50, 30, false, false, null);
    }

    /** A NORMAL event costing 1 energy — the cost proves what each path charges. */
    private static EventEntity event() {
        EventEntity e = new EventEntity();
        e.setId(EVENT_ID);
        e.setUuid(EVENT_UUID);
        e.setType("NORMAL");
        e.setCostEnery(1);
        e.setCostCoin(0);
        e.setFlagEndTime(0);
        return e;
    }

    private static EventCheckContext ctx() {
        return new EventCheckContext(CHAR_ID, LOC, false, false, 20, 10, 50L,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }

    private static ChoiceEntity choice(long id, Integer priority) {
        ChoiceEntity c = new ChoiceEntity();
        c.setId(id);
        c.setUuid("choice-" + id);
        c.setIdEvent((int) EVENT_ID);
        c.setPriority(priority);
        c.setOtherwiseFlag(0);
        c.setLogicOperator("AND");
        return c;
    }

    private static ChoiceConditionEntity cond(String type, String key, String value, String op) {
        ChoiceConditionEntity c = new ChoiceConditionEntity();
        c.setType(type);
        c.setKey(key);
        c.setValue(value);
        c.setOperator(op);
        return c;
    }

    private void givenChoices(ChoiceEntity... choices) {
        when(store.findChoicesByEventId(STORY_ID, EVENT_ID)).thenReturn(List.of(choices));
    }

    /** An event that was opened once and never resolved: one EXECUTED marker, no SELECTED. */
    private void givenOpenCycle() {
        EventCheckContext consumed = new EventCheckContext(CHAR_ID, LOC, false, false, 20, 10, 50L,
                new HashSet<>(), null, new HashSet<>(Set.of(EVENT_ID)), new HashMap<>());
        when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(consumed);
        when(store.countLogMarkers(MATCH_ID, EVENT_ID, EventExecutionStorePort.MSG_EVENT_EXECUTED)).thenReturn(1);
        when(store.countLogMarkers(MATCH_ID, EVENT_ID, EventExecutionStorePort.MSG_CHOICE_SELECTED)).thenReturn(0);
    }

    /** An event whose one cycle was resolved (Step 32 wrote CHOICE_SELECTED): 1 = 1. */
    private void givenClosedCycle() {
        givenOpenCycle();
        when(store.countLogMarkers(MATCH_ID, EVENT_ID, EventExecutionStorePort.MSG_CHOICE_SELECTED)).thenReturn(1);
    }

    private EventExecutionResult execute() {
        return service.executeEvent(MATCH_UUID, USER_UUID, EVENT_UUID, "en");
    }

    // ── the 0-choice regression ─────────────────────────────────────────────

    @Nested
    @DisplayName("Without choices")
    class WithoutChoices {

        @Test
        @DisplayName("A plain event answers APPLIED with no pending choices")
        void appliedStatus() {
            EventExecutionResult r = execute();
            assertEquals(EventExecutionPort.STATUS_APPLIED, r.status());
            assertTrue(r.pendingChoices().isEmpty());
            verify(store).findChoicesByEventId(STORY_ID, EVENT_ID);
        }
    }

    // ── opening a choice-event ──────────────────────────────────────────────

    @Nested
    @DisplayName("First open")
    class FirstOpen {

        @Test
        @DisplayName("Answers CHOICES_PENDING with the event's options")
        void pendingStatus() {
            givenChoices(choice(11, 1), choice(12, 2));
            EventExecutionResult r = execute();
            assertEquals(EventExecutionPort.STATUS_CHOICES_PENDING, r.status());
            assertEquals(2, r.pendingChoices().size());
            assertEquals(List.of(EVENT_UUID), r.executedEventUuids());
        }

        @Test
        @DisplayName("Pays the cost and writes exactly one EVENT_EXECUTED marker")
        void paysAndMarks() {
            givenChoices(choice(11, 1));
            EventExecutionResult r = execute();
            assertEquals(1, r.energySpent());
            assertEquals(19, r.newEnergy());
            verify(store, times(1)).logEventExecuted(eq(MATCH_ID), eq(CHAR_ID), eq(EVENT_ID),
                    eq(7), eq(EventExecutionStorePort.MSG_EVENT_EXECUTED + " " + EVENT_ID), any());
            // The deduction is flushed: energy 19, everything else untouched.
            verify(store).updateCharacterStats(MATCH_ID, CHAR_ID,
                    new CharacterStats(10, 10, 10, 19, 30, 0, 0, 100, 100, 50, 30));
        }

        @Test
        @DisplayName("Withholds the event's own effects — presenting REPLACES applying")
        void effectsWithheld() {
            givenChoices(choice(11, 1));
            EventEffectEntity effect = new EventEffectEntity();
            effect.setId(9L);
            effect.setIdEvent((int) EVENT_ID);
            effect.setStatistics("life");
            effect.setValue(-5);
            when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(EVENT_ID, List.of(effect)));

            EventExecutionResult r = execute();
            assertTrue(r.effects().isEmpty());
            assertTrue(r.statChanges().isEmpty());
            // Life stayed 30 in the flushed stats: the -5 never ran.
            verify(store).updateCharacterStats(MATCH_ID, CHAR_ID,
                    new CharacterStats(10, 10, 10, 19, 30, 0, 0, 100, 100, 50, 30));
        }

        @Test
        @DisplayName("Withholds the idEventNext chain")
        void chainWithheld() {
            EventEntity head = event();
            head.setIdEventNext(2);
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(head));
            givenChoices(choice(11, 1));

            EventExecutionResult r = execute();
            assertEquals(List.of(EVENT_UUID), r.executedEventUuids());
            verify(store, times(1)).logEventExecuted(anyLong(), anyLong(), anyLong(), anyInt(), anyString(), any());
        }

        @Test
        @DisplayName("Withholds flag_end_time, edge states and gameOver")
        void tailWithheld() {
            EventEntity head = event();
            head.setFlagEndTime(1);
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(head));
            when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.of(EVENT_ID));
            givenChoices(choice(11, 1));

            EventExecutionResult r = execute();
            assertFalse(r.timeEnded());
            assertFalse(r.gameOver());
            assertFalse(r.edgeState().anything());
            verifyNoInteractions(timeAdvancementService);
            verifyNoInteractions(edgeStore);
        }

        @Test
        @DisplayName("An unavailable event is still rejected on first open")
        void verdictStillGates() {
            EventEntity costly = event();
            costly.setCostEnery(999);
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(costly));
            givenChoices(choice(11, 1));

            EventExecutionException ex = assertThrows(EventExecutionException.class,
                    EventExecutionServiceChoicesTest.this::execute);
            assertEquals(Code.NOT_ENOUGH_ENERGY, ex.getCode());
            verify(store, never()).logEventExecuted(anyLong(), anyLong(), anyLong(), anyInt(), anyString(), any());
        }
    }

    // ── the idempotent re-fetch ─────────────────────────────────────────────

    @Nested
    @DisplayName("Open cycle (re-fetch)")
    class OpenCycle {

        @Test
        @DisplayName("Serves the options again without charging or marking")
        void freeReFetch() {
            givenOpenCycle();
            givenChoices(choice(11, 1));

            EventExecutionResult r = execute();
            assertEquals(EventExecutionPort.STATUS_CHOICES_PENDING, r.status());
            assertEquals(0, r.energySpent());
            assertEquals(20, r.newEnergy());
            assertEquals(List.of(EVENT_UUID), r.executedEventUuids());
            verify(store, never()).logEventExecuted(anyLong(), anyLong(), anyLong(), anyInt(), anyString(), any());
            verify(store, never()).updateCharacterStats(anyLong(), anyLong(), any());
        }

        @Test
        @DisplayName("Bypasses the verdict: a spent ONCE still serves")
        void onceStillServes() {
            EventEntity once = event();
            once.setType("ONCE");
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(once));
            givenOpenCycle();
            givenChoices(choice(11, 1));

            assertEquals(EventExecutionPort.STATUS_CHOICES_PENDING, execute().status());
        }

        @Test
        @DisplayName("Bypasses the verdict: energy below the cost still serves")
        void brokeStillServes() {
            EventEntity costly = event();
            costly.setCostEnery(999);
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(costly));
            givenOpenCycle();
            givenChoices(choice(11, 1));

            EventExecutionResult r = execute();
            assertEquals(EventExecutionPort.STATUS_CHOICES_PENDING, r.status());
            assertEquals(0, r.energySpent());
        }

        @Test
        @DisplayName("A resolved cycle (counts equal) starts a NEW cycle for a NORMAL event")
        void closedCycleChargesAgain() {
            givenClosedCycle();
            givenChoices(choice(11, 1));

            EventExecutionResult r = execute();
            assertEquals(EventExecutionPort.STATUS_CHOICES_PENDING, r.status());
            assertEquals(1, r.energySpent());
            verify(store, times(1)).logEventExecuted(anyLong(), anyLong(), anyLong(), anyInt(), anyString(), any());
        }

        @Test
        @DisplayName("A resolved cycle of a ONCE event is spent for good")
        void closedOnceIsSpent() {
            EventEntity once = event();
            once.setType("ONCE");
            when(store.findEventByStoryAndUuid(STORY_ID, EVENT_UUID)).thenReturn(Optional.of(once));
            givenClosedCycle();
            givenChoices(choice(11, 1));

            EventExecutionException ex = assertThrows(EventExecutionException.class,
                    EventExecutionServiceChoicesTest.this::execute);
            assertEquals(Code.ONCE_ALREADY_CONSUMED, ex.getCode());
        }

        @Test
        @DisplayName("The marker counts are only consulted for an already-executed event")
        void countsAreLazy() {
            givenChoices(choice(11, 1));
            execute();
            verify(store, never()).countLogMarkers(anyLong(), anyLong(), anyString());
        }
    }

    // ── the options themselves ──────────────────────────────────────────────

    @Nested
    @DisplayName("Options")
    class Options {

        @Test
        @DisplayName("Sorted by priority then id, none dropped")
        void ordering() {
            ChoiceEntity last = choice(13, 2);
            ChoiceEntity first = choice(11, 1);
            ChoiceEntity middle = choice(12, 2); // ties with 13 on priority, wins on id
            givenChoices(last, first, middle);

            List<PendingChoice> out = execute().pendingChoices();
            assertEquals(List.of("choice-11", "choice-12", "choice-13"),
                    out.stream().map(PendingChoice::uuid).toList());
        }

        @Test
        @DisplayName("Each option carries its resolved texts and card")
        void enrichment() {
            ChoiceEntity c = choice(11, 1);
            c.setIdTextName(600);
            c.setIdTextDescription(601);
            c.setIdCard(70);
            givenChoices(c);
            when(store.resolveShortText(STORY_ID, 600, "en")).thenReturn("Gold Door");
            when(store.resolveShortText(STORY_ID, 601, "en")).thenReturn("Shiny.");
            CardInfo card = mock(CardInfo.class);
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 70, "en")).thenReturn(card);

            PendingChoice out = execute().pendingChoices().get(0);
            assertEquals("Gold Door", out.name());
            assertEquals("Shiny.", out.description());
            assertSame(card, out.card());
            assertTrue(out.available());
            assertNull(out.reason());
        }

        @Test
        @DisplayName("Unavailable options are returned with their reason, never dropped")
        void unavailableSurfaced() {
            ChoiceEntity gated = choice(11, 1);
            givenChoices(gated, choice(12, 2));
            when(store.findChoiceConditionsByChoiceId(STORY_ID)).thenReturn(Map.of(
                    11L, List.of(cond("statistics", "int", "99", ">"))));

            List<PendingChoice> out = execute().pendingChoices();
            assertEquals(2, out.size());
            assertFalse(out.get(0).available());
            assertEquals(ChoiceAvailabilityChecker.CONDITION_STATISTICS_NOT_MET, out.get(0).reason());
            assertTrue(out.get(1).available());
        }

        @Test
        @DisplayName("The checker sees POST-deduction stats — the player chooses with what is left")
        void postDeductionStats() {
            ChoiceEntity c = choice(11, 1);
            givenChoices(c);
            // Energy was 20, the open costs 1: a "> 19" gate must fail after paying.
            when(store.findChoiceConditionsByChoiceId(STORY_ID)).thenReturn(Map.of(
                    11L, List.of(cond("statistics", "energy", "19", ">"))));

            PendingChoice out = execute().pendingChoices().get(0);
            assertFalse(out.available());
            assertEquals(ChoiceAvailabilityChecker.CONDITION_STATISTICS_NOT_MET, out.reason());
        }

        @Test
        @DisplayName("Traits are read only when a traits condition exists")
        void traitsLazy() {
            givenChoices(choice(11, 1));
            execute();
            verify(store, never()).findTraitIdsByCharacter(anyLong(), anyLong());

            when(store.findChoiceConditionsByChoiceId(STORY_ID)).thenReturn(Map.of(
                    11L, List.of(cond("traits", null, "9", "="))));
            when(store.findTraitIdsByCharacter(MATCH_ID, CHAR_ID)).thenReturn(Set.of(9L));
            givenOpenCycle();

            PendingChoice out = execute().pendingChoices().get(0);
            assertTrue(out.available());
            verify(store).findTraitIdsByCharacter(MATCH_ID, CHAR_ID);
        }

        @Test
        @DisplayName("statistics_SUM pools every character of the match")
        void partySums() {
            EventActorView mate = new EventActorView(4L, "mate-uuid", 9L, 50L, LOC,
                    10, 7, 10, 20, 30, 0, 0, 100, 100, 50, 30, false, false, null);
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(), mate));
            givenChoices(choice(11, 1));
            // Actor int 10 + mate int 7 = 17.
            when(store.findChoiceConditionsByChoiceId(STORY_ID)).thenReturn(Map.of(
                    11L, List.of(cond("statistics_SUM", "int", "16", ">"))));

            assertTrue(execute().pendingChoices().get(0).available());
        }

        @Test
        @DisplayName("ALL_IN_SAME_LOC fails when the party is scattered")
        void scatteredParty() {
            EventActorView far = new EventActorView(4L, "far-uuid", 9L, 50L, 999L,
                    10, 10, 10, 20, 30, 0, 0, 100, 100, 50, 30, false, false, null);
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(), far));
            givenChoices(choice(11, 1));
            when(store.findChoiceConditionsByChoiceId(STORY_ID)).thenReturn(Map.of(
                    11L, List.of(cond("ALL_IN_SAME_LOC", null, null, null))));

            PendingChoice out = execute().pendingChoices().get(0);
            assertFalse(out.available());
            assertEquals(ChoiceAvailabilityChecker.CONDITION_ALL_IN_SAME_LOC_NOT_MET, out.reason());
        }
    }
}
