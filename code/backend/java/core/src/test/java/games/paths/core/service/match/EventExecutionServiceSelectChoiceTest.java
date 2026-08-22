package games.paths.core.service.match;

import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.ChoiceEffectEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.EventExecutionPort.ChoiceResolutionResult;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException.Code;
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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * EventExecutionService.selectChoice (Step 32) — resolving one option of an open cycle.
 *
 * <p>The three things worth proving here, because getting any of them wrong is silent:
 * that resolution charges nothing (the open already paid), that it is gated on the cycle
 * really being open (the cost-bypass guard), and that a choice effect reaches the world
 * through the very same helpers an event effect does.</p>
 *
 * <p>The per-option verdict matrix lives in {@code ChoiceAvailabilityCheckerTest}; here
 * only its wiring at resolution time is exercised.</p>
 */
@DisplayName("EventExecutionService.selectChoice (Step 32)")
class EventExecutionServiceSelectChoiceTest {

    private static final String MATCH_UUID = "match-uuid";
    private static final String USER_UUID = "user-uuid";
    private static final String EVENT_UUID = "event-uuid";
    private static final String CHOICE_UUID = "choice-uuid";
    private static final long MATCH_ID = 1L;
    private static final long USER_ID = 2L;
    private static final long CHAR_ID = 3L;
    private static final long OTHER_CHAR_ID = 33L;
    private static final long STORY_ID = 4L;
    private static final long LOC = 100L;
    private static final long FAR_LOC = 200L;
    private static final long EVENT_ID = 1L;
    private static final long CHOICE_ID = 10L;
    private static final int CLOCK = 7;

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
        service = new EventExecutionService(store, edgeStore, userAccessPort, contentQueryPort,
                timeAdvancementService);

        when(userAccessPort.findByUuid(USER_UUID)).thenReturn(Optional.of(
                new UserAccessPort.UserView(USER_ID, USER_UUID, "player", "USER", 2)));
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(match()));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(actor()));
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor()));
        // v0.35.1 — no cap unless a case says otherwise, and the add goes through: a bare
        // mock would answer false and every item effect would read as refused.
        when(store.addItem(anyLong(), anyLong(), anyLong(), any())).thenReturn(true);
        when(store.findBackpack(anyLong(), anyLong())).thenReturn(Optional.of(new BackpackStats(5, 5, 10)));
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event()));
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of());
        when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.empty());
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.empty());
        when(store.findItemUuidsById(STORY_ID)).thenReturn(Map.of(7L, "item-uuid"));
        when(store.findTraitUuidsById(STORY_ID)).thenReturn(Map.of());
        when(store.findLocationUuidsById(STORY_ID)).thenReturn(Map.of(LOC, "loc-here", FAR_LOC, "loc-far"));
        when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(ctx());
        when(store.findChoicesByEventId(anyLong(), anyLong())).thenReturn(List.of());
        when(store.findChoiceConditionsByChoiceId(STORY_ID)).thenReturn(Map.of());
        when(store.findChoiceEffectsByChoiceId(STORY_ID, CHOICE_ID)).thenReturn(List.of());
        when(store.findChoiceByStoryAndUuid(STORY_ID, CHOICE_UUID)).thenReturn(Optional.of(choice()));
        when(store.findTraitIdsByCharacter(MATCH_ID, CHAR_ID)).thenReturn(Set.of());
        givenOpenCycle();
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static MatchEventView match() {
        return new MatchEventView(MATCH_ID, MATCH_UUID, "RUNNING", CLOCK, STORY_ID, USER_ID, null);
    }

    private static EventActorView actor() {
        return new EventActorView(CHAR_ID, "char-uuid", USER_ID, 50L, LOC,
                10, 10, 10, 20, 30, 0, 0, 100, 100, 50, 30, false, false, null);
    }

    /** A second character standing in the same location — the flag_group target set. */
    private static EventActorView companion() {
        return new EventActorView(OTHER_CHAR_ID, "other-uuid", 99L, 50L, LOC,
                10, 10, 10, 20, 30, 0, 0, 100, 100, 50, 30, false, false, null);
    }

    private static EventEntity event() {
        EventEntity e = new EventEntity();
        e.setId(EVENT_ID);
        e.setUuid(EVENT_UUID);
        e.setType("NORMAL");
        e.setCostEnery(1);
        e.setCoinCost(2);
        e.setFlagEndTime(0);
        return e;
    }

    private static EventCheckContext ctx() {
        return new EventCheckContext(CHAR_ID, LOC, false, false, 20, 10, 50L,
                new HashSet<>(), null, new HashSet<>(Set.of(EVENT_ID)), new HashMap<>());
    }

    private static ChoiceEntity choice() {
        ChoiceEntity c = new ChoiceEntity();
        c.setId(CHOICE_ID);
        c.setUuid(CHOICE_UUID);
        c.setIdEvent((int) EVENT_ID);
        c.setIdCard(11);
        c.setIdTextNarrative(42);
        c.setPriority(1);
        c.setOtherwiseFlag(0);
        c.setIsProgress(0);
        c.setLogicOperator("AND");
        return c;
    }

    private static CardInfo card(String uuid) {
        return new CardInfo(uuid, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null);
    }

    private static ChoiceEffectEntity effect(long id) {
        ChoiceEffectEntity e = new ChoiceEffectEntity();
        e.setId(id);
        e.setUuid("choice-effect-" + id);
        e.setIdChoices((int) CHOICE_ID);
        e.setFlagGroup(0);
        e.setValue(0);
        return e;
    }

    /** One EVENT_EXECUTED marker and no CHOICE_SELECTED: the cycle is open. */
    private void givenOpenCycle() {
        when(store.countLogMarkers(MATCH_ID, EVENT_ID, EventExecutionStorePort.MSG_EVENT_EXECUTED))
                .thenReturn(1);
        when(store.countLogMarkers(MATCH_ID, EVENT_ID, EventExecutionStorePort.MSG_CHOICE_SELECTED))
                .thenReturn(0);
    }

    private void givenEffects(ChoiceEffectEntity... effects) {
        when(store.findChoiceEffectsByChoiceId(STORY_ID, CHOICE_ID)).thenReturn(List.of(effects));
    }

    private ChoiceResolutionResult resolve() {
        return service.selectChoice(MATCH_UUID, USER_UUID, CHOICE_UUID, "en");
    }

    private static Code codeOf(Executable call) {
        EventExecutionException ex = assertThrows(EventExecutionException.class, call::run);
        return ex.getCode();
    }

    @FunctionalInterface
    private interface Executable {
        void run();
    }

    // ── the guards ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("guards")
    class Guards {

        @Test
        @DisplayName("an unknown option is not found")
        void unknownChoice() {
            when(store.findChoiceByStoryAndUuid(STORY_ID, "nope")).thenReturn(Optional.empty());
            assertEquals(Code.CHOICE_NOT_FOUND,
                    codeOf(() -> service.selectChoice(MATCH_UUID, USER_UUID, "nope", "en")));
        }

        @Test
        @DisplayName("an option whose owning event does not exist is rejected")
        void danglingEvent() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of());
            assertEquals(Code.EVENT_NOT_FOUND, codeOf(EventExecutionServiceSelectChoiceTest.this::resolve));
        }

        @Test
        @DisplayName("a match that is not RUNNING is rejected")
        void notRunning() {
            when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(
                    new MatchEventView(MATCH_ID, MATCH_UUID, "PAUSED", CLOCK, STORY_ID, USER_ID, null)));
            assertEquals(Code.MATCH_NOT_RUNNING, codeOf(EventExecutionServiceSelectChoiceTest.this::resolve));
        }

        @Test
        @DisplayName("coma outranks sleep: a comatose character is told so, not that it is asleep")
        void comaOutranksSleep() {
            when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(new EventCheckContext(
                    CHAR_ID, LOC, true, true, 20, 10, 50L, new HashSet<>(), null,
                    new HashSet<>(Set.of(EVENT_ID)), new HashMap<>()));
            assertEquals(Code.COMA, codeOf(EventExecutionServiceSelectChoiceTest.this::resolve));
        }

        @Test
        @DisplayName("a sleeping character cannot resolve")
        void sleeping() {
            when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(new EventCheckContext(
                    CHAR_ID, LOC, true, false, 20, 10, 50L, new HashSet<>(), null,
                    new HashSet<>(Set.of(EVENT_ID)), new HashMap<>()));
            assertEquals(Code.SLEEPING, codeOf(EventExecutionServiceSelectChoiceTest.this::resolve));
        }

        @Test
        @DisplayName("an event that was never opened has no cycle to close — the cost-bypass guard")
        void neverOpened() {
            when(store.countLogMarkers(MATCH_ID, EVENT_ID, EventExecutionStorePort.MSG_EVENT_EXECUTED))
                    .thenReturn(0);
            assertEquals(Code.CHOICE_NOT_OPEN, codeOf(EventExecutionServiceSelectChoiceTest.this::resolve));
        }

        @Test
        @DisplayName("resolving twice is rejected: the markers balance after the first")
        void alreadyResolved() {
            when(store.countLogMarkers(MATCH_ID, EVENT_ID, EventExecutionStorePort.MSG_CHOICE_SELECTED))
                    .thenReturn(1);
            assertEquals(Code.CHOICE_NOT_OPEN, codeOf(EventExecutionServiceSelectChoiceTest.this::resolve));
        }

        @Test
        @DisplayName("an option that has become unavailable since the open is rejected")
        void noLongerAvailable() {
            ChoiceEntity gated = choice();
            gated.setLimitDex(99); // the actor has 10
            when(store.findChoiceByStoryAndUuid(STORY_ID, CHOICE_UUID)).thenReturn(Optional.of(gated));
            EventExecutionException ex = assertThrows(EventExecutionException.class,
                    EventExecutionServiceSelectChoiceTest.this::resolve);
            assertEquals(Code.CHOICE_NOT_AVAILABLE, ex.getCode());
            assertTrue(ex.getMessage().contains(ChoiceAvailabilityChecker.LIMIT_DEX_NOT_MET),
                    "the message names the checker's own reason: " + ex.getMessage());
        }

        @Test
        @DisplayName("a rejected resolution writes nothing at all")
        void rejectionIsInert() {
            when(store.countLogMarkers(MATCH_ID, EVENT_ID, EventExecutionStorePort.MSG_EVENT_EXECUTED))
                    .thenReturn(0);
            assertThrows(EventExecutionException.class, EventExecutionServiceSelectChoiceTest.this::resolve);
            verify(store, never()).logEventExecuted(anyLong(), any(), anyLong(), anyInt(), anyString());
            verify(store, never()).logChoiceExecuted(anyLong(), anyLong(), anyLong(), anyInt(), anyString());
            verify(store, never()).updateCharacterStats(anyLong(), anyLong(), any());
        }
    }

    // ── it charges nothing ──────────────────────────────────────────────────

    @Test
    @DisplayName("resolution charges nothing: the open already paid the energy and the coins")
    void chargesNothing() {
        ChoiceResolutionResult r = resolve();

        assertEquals(0, r.execution().energySpent());
        assertEquals(0, r.execution().coinSpent());
        // The actor's energy is untouched by the resolution itself.
        assertEquals(20, r.execution().newEnergy());
        assertEquals(10, r.execution().newCoin());
    }

    // ── the markers that close the cycle ────────────────────────────────────

    @Test
    @DisplayName("the CHOICE_SELECTED marker carries the OWNING EVENT id, never the choice id")
    void markerCarriesTheEventId() {
        resolve();

        verify(store).logEventExecuted(MATCH_ID, CHAR_ID, EVENT_ID, CLOCK,
                EventExecutionStorePort.MSG_CHOICE_SELECTED + " " + EVENT_ID);
    }

    @Test
    @DisplayName("the choice history row records both the event and the option")
    void writesTheChoiceHistory() {
        resolve();

        verify(store).logChoiceExecuted(eq(MATCH_ID), eq(EVENT_ID), eq(CHOICE_ID), eq(CLOCK), anyString());
    }

    @Test
    @DisplayName("an ordinary option records no milestone")
    void noProgressByDefault() {
        ChoiceResolutionResult r = resolve();

        assertFalse(r.progressRecorded());
        verify(store, never()).insertStoryProgress(anyLong(), anyLong(), anyLong(), anyInt());
    }

    @Test
    @DisplayName("an is_progress option records the narrative milestone")
    void progressRecorded() {
        ChoiceEntity milestone = choice();
        milestone.setIsProgress(1);
        when(store.findChoiceByStoryAndUuid(STORY_ID, CHOICE_UUID)).thenReturn(Optional.of(milestone));

        ChoiceResolutionResult r = resolve();

        assertTrue(r.progressRecorded());
        verify(store).insertStoryProgress(MATCH_ID, EVENT_ID, CHOICE_ID, CLOCK);
    }

    // ── the narrative, revealed at last ─────────────────────────────────────

    @Test
    @DisplayName("the narrative Step 31 withheld is revealed now that the choice is irreversible")
    void revealsTheNarrative() {
        when(store.resolveShortText(STORY_ID, 42, "en")).thenReturn("You push the door open.");

        ChoiceResolutionResult r = resolve();

        assertEquals("You push the door open.", r.narrative());
        assertEquals(CHOICE_UUID, r.choiceUuid());
        assertEquals(EVENT_UUID, r.eventUuid());
    }

    // ── the effects ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("effects")
    class Effects {

        @Test
        @DisplayName("a stat effect moves the stat and reports the delta actually applied")
        void statEffect() {
            ChoiceEffectEntity e = effect(1);
            e.setStatistics("life");
            e.setValue(-4);
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            assertEquals(1, r.execution().statChanges().size());
            EventExecutionPort.StatChange c = r.execution().statChanges().get(0);
            assertEquals("life", c.statistic());
            assertEquals(30, c.before());
            assertEquals(26, c.after());
            verify(store).updateCharacterStats(eq(MATCH_ID), eq(CHAR_ID), any(CharacterStats.class));
        }

        @Test
        @DisplayName("flag_group = 0 touches the acting character alone")
        void soloByDefault() {
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(), companion()));
            ChoiceEffectEntity e = effect(1);
            e.setStatistics("life");
            e.setValue(-4);
            e.setFlagGroup(0);
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            assertEquals(List.of("char-uuid"), r.execution().effects().get(0).characterUuids());
        }

        @Test
        @DisplayName("flag_group = 1 touches everyone standing in the actor's location — INV-46")
        void groupIsLocationScoped() {
            EventActorView elsewhere = new EventActorView(77L, "away-uuid", 98L, 50L, FAR_LOC,
                    10, 10, 10, 20, 30, 0, 0, 100, 100, 50, 30, false, false, null);
            when(store.findCharactersByMatchId(MATCH_ID))
                    .thenReturn(List.of(actor(), companion(), elsewhere));
            ChoiceEffectEntity e = effect(1);
            e.setStatistics("life");
            e.setValue(-4);
            e.setFlagGroup(1);
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            assertEquals(List.of("char-uuid", "other-uuid"),
                    r.execution().effects().get(0).characterUuids(),
                    "the character in another location is not part of the group");
        }

        @Test
        @DisplayName("key + value_to_add writes the registry key")
        void registryAdd() {
            ChoiceEffectEntity e = effect(1);
            e.setKey("DOOR");
            e.setValueToAdd("OPEN");
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            verify(store).upsertRegistry(MATCH_ID, "DOOR", "OPEN", CHAR_ID, EVENT_ID, CLOCK);
            assertEquals(1, r.execution().registryChanges().size());
            assertEquals("OPEN", r.execution().registryChanges().get(0).newValue());
        }

        @Test
        @DisplayName("value_to_remove clears the key when the stored value matches")
        void registryRemoveOnMatch() {
            Map<String, String> registry = new HashMap<>();
            registry.put("DOOR", "OPEN");
            when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(new EventCheckContext(
                    CHAR_ID, LOC, false, false, 20, 10, 50L, new HashSet<>(), null,
                    new HashSet<>(Set.of(EVENT_ID)), registry));
            ChoiceEffectEntity e = effect(1);
            e.setKey("DOOR");
            e.setValueToRemove("OPEN");
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            verify(store).upsertRegistry(MATCH_ID, "DOOR", null, CHAR_ID, EVENT_ID, CLOCK);
            assertNull(r.execution().registryChanges().get(0).newValue());
        }

        @Test
        @DisplayName("value_to_remove leaves a key some other branch has since moved on")
        void registryRemoveOnMismatch() {
            Map<String, String> registry = new HashMap<>();
            registry.put("DOOR", "SEALED");
            when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(new EventCheckContext(
                    CHAR_ID, LOC, false, false, 20, 10, 50L, new HashSet<>(), null,
                    new HashSet<>(Set.of(EVENT_ID)), registry));
            ChoiceEffectEntity e = effect(1);
            e.setKey("DOOR");
            e.setValueToRemove("OPEN");
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            verify(store, never()).upsertRegistry(anyLong(), anyString(), any(), any(), any(), anyInt());
            assertTrue(r.execution().registryChanges().isEmpty());
        }

        @Test
        @DisplayName("id_item_target + item_action grants the item")
        void itemAdd() {
            ChoiceEffectEntity e = effect(1);
            e.setIdItemTarget(7);
            e.setItemAction("ADD");
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            verify(store).addItem(MATCH_ID, CHAR_ID, 7L, null);
            assertTrue(r.execution().itemAdded());
            assertEquals("item-uuid", r.execution().itemChanges().get(0).itemUuid());
        }

        @Test
        @DisplayName("id_location moves the recipients — no adjacency, no energy, a cost-0 log row")
        void forcedMovement() {
            ChoiceEffectEntity e = effect(1);
            e.setIdLocation((int) FAR_LOC);
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            verify(store).updateCharacterLocation(MATCH_ID, CHAR_ID, FAR_LOC);
            verify(store).insertMovementLog(MATCH_ID, CHAR_ID, LOC, FAR_LOC, 0);
            assertTrue(r.execution().movementApplied());
            assertEquals("loc-far", r.execution().locationChanges().get(0).toLocationUuid());
        }

        @Test
        @DisplayName("id_weather sets the match weather once per row, whoever the row targets")
        void weather() {
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(), companion()));
            ChoiceEffectEntity e = effect(1);
            e.setIdWeather(3);
            e.setFlagGroup(1);
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            verify(store, times(1)).setCurrentWeather(MATCH_ID, 3L);
            assertTrue(r.execution().weatherApplied());
        }

        @Test
        @DisplayName("an effect row's own card is the narrative, as for an event effect")
        void effectCard() {
            CardInfo card = card("a-card");
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 55, "en")).thenReturn(card);
            ChoiceEffectEntity e = effect(1);
            e.setIdCard(55);
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            assertSame(card, r.execution().effects().get(0).card());
        }

        @Test
        @DisplayName("rows apply in authored order, so a later one builds on the earlier")
        void authoredOrder() {
            ChoiceEffectEntity first = effect(1);
            first.setStatistics("life");
            first.setValue(-4);
            ChoiceEffectEntity second = effect(2);
            second.setStatistics("life");
            second.setValue(-6);
            givenEffects(first, second);

            ChoiceResolutionResult r = resolve();

            assertEquals(30, r.execution().statChanges().get(0).before());
            assertEquals(26, r.execution().statChanges().get(1).before(),
                    "the second row starts where the first one left off");
            assertEquals(20, r.execution().statChanges().get(1).after());
        }
    }

    // ── the linked events ───────────────────────────────────────────────────

    @Nested
    @DisplayName("linked events")
    class LinkedEvents {

        private EventEntity outcome(long id, String uuid) {
            EventEntity e = new EventEntity();
            e.setId(id);
            e.setUuid(uuid);
            e.setType("NORMAL");
            e.setCostEnery(9); // never charged: a consequence is not a choice
            e.setCoinCost(9);
            e.setFlagEndTime(0);
            return e;
        }

        private EventEffectEntity eventEffect(long idEvent, String stat, int value) {
            EventEffectEntity e = new EventEffectEntity();
            e.setId(idEvent * 100);
            e.setUuid("event-effect-" + idEvent);
            e.setIdEvent((int) idEvent);
            e.setStatistics(stat);
            e.setValue(value);
            e.setTarget("ONLY_ONE");
            return e;
        }

        @Test
        @DisplayName("idEventTorun runs with its full effect chain, and is not charged for")
        void idEventTorunRuns() {
            EventEntity out = outcome(2L, "outcome-uuid");
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event(), 2L, out));
            when(store.findEffectsByEventId(STORY_ID))
                    .thenReturn(Map.of(2L, List.of(eventEffect(2L, "exp", 5))));
            ChoiceEntity c = choice();
            c.setIdEventTorun(2);
            when(store.findChoiceByStoryAndUuid(STORY_ID, CHOICE_UUID)).thenReturn(Optional.of(c));

            ChoiceResolutionResult r = resolve();

            assertTrue(r.execution().executedEventUuids().contains("outcome-uuid"));
            assertEquals(0, r.execution().energySpent(), "a consequence costs nothing");
            assertEquals(1, r.execution().statChanges().size());
            assertEquals("exp", r.execution().statChanges().get(0).statistic());
        }

        @Test
        @DisplayName("an effect's id_event runs inline and its card is what the board narrates")
        void effectIdEventRuns() {
            EventEntity linked = outcome(3L, "linked-uuid");
            linked.setIdCard(88);
            CardInfo card = card("a-card");
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 88, "en")).thenReturn(card);
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event(), 3L, linked));
            when(store.findEffectsByEventId(STORY_ID))
                    .thenReturn(Map.of(3L, List.of(eventEffect(3L, "exp", 2))));
            ChoiceEffectEntity e = effect(1);
            e.setIdEvent(3);
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            assertEquals("linked-uuid", r.choiceEventUuid());
            assertSame(card, r.choiceEventCard());
            assertTrue(r.execution().executedEventUuids().contains("linked-uuid"));
            assertEquals("exp", r.execution().statChanges().get(0).statistic());
        }

        @Test
        @DisplayName("a dangling id_event is authored noise, not an error")
        void danglingLinkIsSkipped() {
            ChoiceEffectEntity e = effect(1);
            e.setIdEvent(404);
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            assertNull(r.choiceEventUuid());
            assertTrue(r.execution().statChanges().isEmpty());
        }

        @Test
        @DisplayName("a NORMAL link runs even when the match already executed it")
        void normalLinkIsNotBarredByHavingRunBefore() {
            // The AWS twin got this wrong until v0.32.0: it tested EVERY link against
            // consumedEventIds instead of ONCE only, so an option's "event to run" fired
            // at most once per match and then silently stopped, effects still applying.
            EventEntity linked = outcome(3L, "linked-uuid");
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event(), 3L, linked));
            when(store.findEffectsByEventId(STORY_ID))
                    .thenReturn(Map.of(3L, List.of(eventEffect(3L, "exp", 2))));
            // 3L is already consumed — it ran earlier in this match.
            when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(new EventCheckContext(
                    CHAR_ID, LOC, false, false, 20, 10, 50L, new HashSet<>(), null,
                    new HashSet<>(Set.of(EVENT_ID, 3L)), new HashMap<>()));
            ChoiceEffectEntity e = effect(1);
            e.setIdEvent(3);
            givenEffects(e);

            ChoiceResolutionResult r = resolve();

            assertTrue(r.execution().executedEventUuids().contains("linked-uuid"),
                    "a NORMAL link is re-runnable however often the match has run it");
            assertEquals("exp", r.execution().statChanges().get(0).statistic());
        }

        @Test
        @DisplayName("the same link named twice runs once")
        void aLinkRunsOncePerResolution() {
            EventEntity linked = outcome(3L, "linked-uuid");
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event(), 3L, linked));
            when(store.findEffectsByEventId(STORY_ID))
                    .thenReturn(Map.of(3L, List.of(eventEffect(3L, "exp", 2))));
            ChoiceEffectEntity first = effect(1);
            first.setIdEvent(3);
            ChoiceEffectEntity second = effect(2);
            second.setIdEvent(3);
            givenEffects(first, second);

            ChoiceResolutionResult r = resolve();

            assertEquals(1, r.execution().executedEventUuids().stream()
                    .filter("linked-uuid"::equals).count());
            assertEquals(1, r.execution().statChanges().size(), "exp applied once, not twice");
        }

        @Test
        @DisplayName("a spent ONCE stays spent, whoever points at it")
        void spentOnceIsNotRerun() {
            EventEntity once = outcome(5L, "once-uuid");
            once.setType("ONCE");
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event(), 5L, once));
            when(store.findEffectsByEventId(STORY_ID))
                    .thenReturn(Map.of(5L, List.of(eventEffect(5L, "exp", 3))));
            when(store.loadCheckContext(MATCH_ID, CHAR_ID)).thenReturn(new EventCheckContext(
                    CHAR_ID, LOC, false, false, 20, 10, 50L, new HashSet<>(), null,
                    new HashSet<>(Set.of(EVENT_ID, 5L)), new HashMap<>()));
            ChoiceEntity c = choice();
            c.setIdEventTorun(5);
            when(store.findChoiceByStoryAndUuid(STORY_ID, CHOICE_UUID)).thenReturn(Optional.of(c));

            ChoiceResolutionResult r = resolve();

            assertFalse(r.execution().executedEventUuids().contains("once-uuid"));
            assertTrue(r.execution().statChanges().isEmpty());
        }

        @Test
        @DisplayName("a linked event that is itself a choice-event presents its options, free")
        void nestedChoiceEvent() {
            EventEntity nested = outcome(6L, "nested-uuid");
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event(), 6L, nested));
            ChoiceEntity nestedOption = new ChoiceEntity();
            nestedOption.setId(60L);
            nestedOption.setUuid("nested-choice");
            nestedOption.setIdEvent(6);
            nestedOption.setPriority(1);
            nestedOption.setOtherwiseFlag(1);
            when(store.findChoicesByEventId(STORY_ID, 6L)).thenReturn(List.of(nestedOption));
            ChoiceEntity c = choice();
            c.setIdEventTorun(6);
            when(store.findChoiceByStoryAndUuid(STORY_ID, CHOICE_UUID)).thenReturn(Optional.of(c));

            ChoiceResolutionResult r = resolve();

            assertEquals(EventExecutionPort.STATUS_CHOICES_PENDING, r.execution().status());
            assertEquals(1, r.execution().pendingChoices().size());
            assertEquals("nested-choice", r.execution().pendingChoices().get(0).uuid());
            assertTrue(r.execution().pendingChoices().get(0).available());
            // Opened for free — a consequence is not a choice — but marked, so its own cycle opens.
            assertEquals(0, r.execution().energySpent());
            verify(store).logEventExecuted(MATCH_ID, CHAR_ID, 6L, CLOCK,
                    EventExecutionStorePort.MSG_EVENT_EXECUTED + " " + 6L);
        }
    }

    // ── the Step 30 tail still runs ─────────────────────────────────────────

    @Test
    @DisplayName("a lethal choice effect triggers the coma rules")
    void lethalEffectTriggersComa() {
        ChoiceEffectEntity e = effect(1);
        e.setStatistics("life");
        e.setValue(-99);
        givenEffects(e);

        ChoiceResolutionResult r = resolve();

        assertTrue(r.execution().comaTriggered());
        assertTrue(r.execution().edgeState().comaUuids().contains("char-uuid"));
    }

    @Test
    @DisplayName("a lethal row does not silence its siblings — the edge pass comes after them all")
    void lethalRowDoesNotStopItsSiblings() {
        ChoiceEffectEntity lethal = effect(1);
        lethal.setStatistics("life");
        lethal.setValue(-99);
        ChoiceEffectEntity after = effect(2);
        after.setIdItemTarget(7);
        after.setItemAction("ADD");
        givenEffects(lethal, after);

        resolve();

        // Same rule as an event: all of one event's effects land, then the Step 30 pass.
        verify(store).addItem(MATCH_ID, CHAR_ID, 7L, null);
    }

    @Test
    @DisplayName("a coma stops the consequences: a character who cannot act does not act them out")
    void comaStopsTheLinkedEvents() {
        EventEntity linked = new EventEntity();
        linked.setId(3L);
        linked.setUuid("linked-uuid");
        linked.setType("NORMAL");
        linked.setFlagEndTime(0);
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event(), 3L, linked));
        ChoiceEffectEntity lethal = effect(1);
        lethal.setStatistics("life");
        lethal.setValue(-99);
        lethal.setIdEvent(3);
        givenEffects(lethal);
        ChoiceEntity c = choice();
        c.setIdEventTorun(3);
        when(store.findChoiceByStoryAndUuid(STORY_ID, CHOICE_UUID)).thenReturn(Optional.of(c));

        ChoiceResolutionResult r = resolve();

        assertTrue(r.execution().comaTriggered());
        assertFalse(r.execution().executedEventUuids().contains("linked-uuid"));
    }

    @Test
    @DisplayName("an effect leading to a flag_end_time event ends the time unit")
    void flagEndTimeStillFires() {
        EventEntity ender = new EventEntity();
        ender.setId(4L);
        ender.setUuid("ender-uuid");
        ender.setType("NORMAL");
        ender.setFlagEndTime(1);
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(EVENT_ID, event(), 4L, ender));
        when(timeAdvancementService.forceTimeEnd(MATCH_UUID))
                .thenReturn(new TimeAdvancementService.TimeEndOutcome(CLOCK + 1, List.of(), List.of()));
        ChoiceEntity c = choice();
        c.setIdEventTorun(4);
        when(store.findChoiceByStoryAndUuid(STORY_ID, CHOICE_UUID)).thenReturn(Optional.of(c));

        ChoiceResolutionResult r = resolve();

        assertTrue(r.execution().timeEnded());
        assertEquals(CLOCK + 1, r.execution().currentClock());
    }

    // ── the shared shape ────────────────────────────────────────────────────

    @Test
    @DisplayName("the execution block is the execute-event payload, so the board has one code path")
    void reusesTheExecutionPayload() {
        ChoiceResolutionResult r = resolve();

        assertEquals(MATCH_UUID, r.execution().matchUuid());
        assertEquals(EVENT_UUID, r.execution().eventUuid());
        assertEquals("NORMAL", r.execution().eventType());
        assertEquals(EventExecutionPort.STATUS_APPLIED, r.execution().status());
        assertFalse(r.execution().turnConsumed(), "turns are Step 61, for every action at once");
        assertEquals(List.of(), r.execution().pendingChoices());
    }
}
