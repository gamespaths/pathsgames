package games.paths.core.service.match;

import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.EventActorView;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.EventExecutionStorePort.MatchEventView;
import games.paths.core.port.match.LocationEntryPort;
import games.paths.core.port.match.LocationEntryPort.ArrivalContext;
import games.paths.core.port.match.LocationEntryPort.AutomaticEventFired;
import games.paths.core.port.match.LocationEntryPort.PendingAutomaticEvent;
import games.paths.core.port.match.LocationEntryStorePort;
import games.paths.core.port.match.LocationEntryStorePort.LocationTriggerView;
import games.paths.core.port.match.TimeAdvancementPort.CounterZeroItem;
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
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Step 33 — the events nobody asks for.
 *
 * <p>Everything here goes through {@code LocationEntryPort}, which
 * {@link EventExecutionService} implements: an arrival, or a time-start that collected a
 * counter fuse. What separates these from Step 29 execution is what they do <em>not</em> do —
 * no cost, no availability verdict, no choices — and the one thing only they can do: run with
 * no actor at all.</p>
 */
class EventExecutionServiceAutomaticTest {

    private static final long MATCH_ID = 1L;
    private static final long STORY_ID = 9L;
    private static final long CHAR_ID = 7L;
    private static final long LOCATION = 90002L;
    private static final int CLOCK = 4;

    private EventExecutionStorePort store;
    private EdgeStateStorePort edgeStore;
    private LocationEntryStorePort locationStore;
    private ContentQueryPort contentQueryPort;
    private EventExecutionService service;

    @BeforeEach
    void setUp() {
        store = mock(EventExecutionStorePort.class);
        edgeStore = mock(EdgeStateStorePort.class);
        locationStore = mock(LocationEntryStorePort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        service = new EventExecutionService(store, edgeStore, mock(UserAccessPort.class),
                contentQueryPort, null, locationStore);

        when(store.findMatchById(MATCH_ID)).thenReturn(Optional.of(
                new MatchEventView(MATCH_ID, "m1", "RUNNING", CLOCK, STORY_ID, 3L, null)));
        when(store.findCharacterByMatchAndId(MATCH_ID, CHAR_ID)).thenReturn(Optional.of(actor()));
        when(store.loadCheckContext(eq(MATCH_ID), any())).thenAnswer(
                inv -> context(inv.getArgument(1)));
        when(store.findChoicesByEventId(anyLong(), anyLong())).thenReturn(List.of());
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of());
        when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.empty());
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.empty());
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor()));
        when(store.findBackpack(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(store.findLocationUuidsById(STORY_ID)).thenReturn(Map.of(LOCATION, "loc-b", 90003L, "loc-c"));
    }

    // ── arrival dispatch ────────────────────────────────────────────────────

    @Nested
    @DisplayName("onArrival")
    class OnArrival {

        @Test
        @DisplayName("a never-visited destination fires id_event_if_first_time")
        void firstEntry() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(40L, event(40L, "evt-first")));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, null, null)));
            when(locationStore.findFlagVisited(MATCH_ID, LOCATION)).thenReturn(0);

            List<AutomaticEventFired> fired = service.onArrival(arrival());

            assertEquals(1, fired.size());
            assertEquals(LocationEntryPort.TRIGGER_FIRST_ENTRY, fired.get(0).trigger());
            assertEquals("evt-first", fired.get(0).eventUuid());
            assertEquals(LOCATION, fired.get(0).idLocation());
        }

        @Test
        @DisplayName("a visited destination fires id_event_not_first_time instead")
        void subsequentEntry() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(
                    40L, event(40L, "evt-first"), 41L, event(41L, "evt-again")));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, 41, null)));
            when(locationStore.findFlagVisited(MATCH_ID, LOCATION)).thenReturn(1);

            List<AutomaticEventFired> fired = service.onArrival(arrival());

            assertEquals(1, fired.size());
            assertEquals(LocationEntryPort.TRIGGER_SUBSEQUENT_ENTRY, fired.get(0).trigger());
            assertEquals("evt-again", fired.get(0).eventUuid());
        }

        @Test
        @DisplayName("the two history triggers are exclusive — never both on one arrival")
        void historyTriggersAreExclusive() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(
                    40L, event(40L, "evt-first"), 41L, event(41L, "evt-again")));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, 41, null)));
            when(locationStore.findFlagVisited(MATCH_ID, LOCATION)).thenReturn(0);

            List<AutomaticEventFired> fired = service.onArrival(arrival());

            assertEquals(1, fired.size());
            assertEquals("evt-first", fired.get(0).eventUuid());
        }

        @Test
        @DisplayName("an empty destination also fires id_event_if_character_enter_empty_location")
        void firstInLocationIsOrthogonal() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(
                    40L, event(40L, "evt-first"), 42L, event(42L, "evt-alone")));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, null, 42)));
            when(locationStore.findFlagVisited(MATCH_ID, LOCATION)).thenReturn(0);
            when(locationStore.countOtherCharactersAtLocation(MATCH_ID, LOCATION, CHAR_ID))
                    .thenReturn(0);

            List<AutomaticEventFired> fired = service.onArrival(arrival());

            assertEquals(2, fired.size());
            assertEquals(LocationEntryPort.TRIGGER_FIRST_ENTRY, fired.get(0).trigger());
            assertEquals(LocationEntryPort.TRIGGER_MOVE_INTO_EMPTY_LOCATION, fired.get(1).trigger());
        }

        @Test
        @DisplayName("somebody else is already there, so MOVE_INTO_EMPTY_LOCATION does not fire")
        void notAloneSuppressesFirstInLocation() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(42L, event(42L, "evt-alone")));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(null, null, 42)));
            when(locationStore.countOtherCharactersAtLocation(MATCH_ID, LOCATION, CHAR_ID))
                    .thenReturn(1);

            assertTrue(service.onArrival(arrival()).isEmpty());
        }

        @Test
        @DisplayName("a location that authors no trigger fires nothing but is still marked visited")
        void noTriggersStillLatchesVisited() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of());
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(null, null, null)));

            assertTrue(service.onArrival(arrival()).isEmpty());
            verify(locationStore).markStateLocationVisited(MATCH_ID, LOCATION);
        }

        @Test
        @DisplayName("flag_visited is latched AFTER the triggers are read, never before")
        void visitedIsLatchedAfterResolution() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(40L, event(40L, "evt-first")));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, 41, null)));
            when(locationStore.findFlagVisited(MATCH_ID, LOCATION)).thenReturn(0);

            List<AutomaticEventFired> fired = service.onArrival(arrival());

            // Had the flag been written first, this same arrival would have read 1 and
            // reported SUBSEQUENT_ENTRY — the discovery would never fire for anyone.
            assertEquals(LocationEntryPort.TRIGGER_FIRST_ENTRY, fired.get(0).trigger());
            verify(locationStore).markStateLocationVisited(MATCH_ID, LOCATION);
        }

        @Test
        @DisplayName("a trigger pointing at an event that does not exist is skipped, not fatal")
        void danglingEventIdIsSkipped() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of());
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(999, null, null)));

            assertTrue(service.onArrival(arrival()).isEmpty());
        }

        @Test
        @DisplayName("an unknown location resolves to nothing")
        void unknownLocation() {
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION)).thenReturn(Optional.empty());
            assertTrue(service.onArrival(arrival()).isEmpty());
        }
    }

    // ── the constraints that make an automatic event different ──────────────

    @Nested
    @DisplayName("what an automatic event may not do")
    class Constraints {

        @Test
        @DisplayName("an event owning choices is refused and logged, never opened")
        void choiceOwningEventIsRefused() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(40L, event(40L, "evt-first")));
            when(store.findChoicesByEventId(STORY_ID, 40L)).thenReturn(List.of(new ChoiceEntity()));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, null, null)));

            assertTrue(service.onArrival(arrival()).isEmpty());
            // No EVENT_EXECUTED marker: writing one would open a cycle that no select-choice
            // call could ever close, and the match would carry it for ever.
            verify(store, never()).logEventExecuted(anyLong(), any(), anyLong(), anyInt(), anyString(), any(), any());
            verify(locationStore).logAutomaticEvent(eq(MATCH_ID), any(), eq(LOCATION), eq(40L),
                    anyInt(), anyString());
        }

        @Test
        @DisplayName("nobody pays: the event's energy and coin cost are not deducted")
        void costsAreNotDeducted() {
            EventEntity costly = event(40L, "evt-costly");
            costly.setCostEnery(99);
            costly.setCostCoin(99);
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(40L, costly));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, null, null)));

            List<AutomaticEventFired> fired = service.onArrival(arrival());

            assertEquals(1, fired.size());
            assertTrue(fired.get(0).statChanges().isEmpty());
        }

        @Test
        @DisplayName("v0.35.6: a lethal arrival reports its Step 30 verdict, epilogue and all")
        void aLethalArrivalCarriesItsEdgeState() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(
                    40L, event(40L, "evt-trap"), 50L, event(50L, "evt-coma")));
            when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(
                    40L, List.of(lethalEffect())));
            when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.of(50L));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, null, null)));
            when(locationStore.findFlagVisited(MATCH_ID, LOCATION)).thenReturn(0);

            List<AutomaticEventFired> fired = service.onArrival(arrival());

            EventExecutionPort.EdgeStateOutcome edge = fired.get(0).edgeState();
            assertTrue(edge.comaUuids().contains("char-1"));
            assertTrue(edge.allPlayersInComa());
            assertEquals("evt-coma", edge.comaEventUuid());
            assertEquals(List.of("evt-coma"), edge.comaExecutedEventUuids());
        }

        @Test
        @DisplayName("v0.35.6: an ordinary arrival answers an empty edge state, never null")
        void aQuietArrivalCarriesAnEmptyEdgeState() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(40L, event(40L, "evt-first")));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, null, null)));
            when(locationStore.findFlagVisited(MATCH_ID, LOCATION)).thenReturn(0);

            List<AutomaticEventFired> fired = service.onArrival(arrival());

            assertNotNull(fired.get(0).edgeState());
            assertFalse(fired.get(0).edgeState().anything());
        }

        @Test
        @DisplayName("a forced-movement loop aborts at the depth cap instead of hanging")
        void forcedMovementLoopAborts() {
            // The story an author can write in two admin form fields: 40 pushes you to 90003,
            // whose trigger 41 pushes you back to 90002, whose trigger is 40 again. Nothing
            // inside the chain runner stops this — each arrival gets a fresh visited set.
            AtomicLong where = new AtomicLong(LOCATION);
            doAnswer(inv -> {
                where.set(inv.getArgument(2));
                return null;
            }).when(store).updateCharacterLocation(anyLong(), anyLong(), anyLong());
            when(store.findCharacterByMatchAndId(MATCH_ID, CHAR_ID))
                    .thenAnswer(inv -> Optional.of(actorAt(where.get())));

            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(
                    40L, event(40L, "evt-to-c"), 41L, event(41L, "evt-to-b")));
            when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(
                    40L, List.of(moveEffect(90003)),
                    41L, List.of(moveEffect((int) LOCATION))));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(40, 40, null)));
            when(locationStore.findLocationTriggers(STORY_ID, 90003L))
                    .thenReturn(Optional.of(new LocationTriggerView(90003L, null, 41, 41,
                            null, null, null, 0)));

            List<AutomaticEventFired> fired = service.onArrival(arrival());

            // It terminates — that is the whole point — and it says so in the log rather than
            // hanging the request that triggered it.
            assertTrue(fired.size() <= 16, "the cascade must be bounded, got " + fired.size());
            verify(locationStore).logAutomaticEvent(anyLong(), any(), anyLong(), eq(null),
                    any(), anyString());
        }
    }

    // ── the counter-zero / time-start path ──────────────────────────────────

    @Nested
    @DisplayName("runPendingAutomaticEvents")
    class Pending {

        @Test
        @DisplayName("runs the list the time-start collected, in the order it was given")
        void runsInOrder() {
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(
                    50L, event(50L, "evt-a"), 51L, event(51L, "evt-b")));

            List<AutomaticEventFired> fired = service.runPendingAutomaticEvents(MATCH_ID, CLOCK,
                    List.of(new PendingAutomaticEvent(LocationEntryPort.TRIGGER_COUNTER_ZERO,
                                    LOCATION, 50L, CHAR_ID, 1),
                            new PendingAutomaticEvent(LocationEntryPort.TRIGGER_CHARACTER_START_TIME,
                                    90003L, 51L, null, 2)),
                    "en");

            assertEquals(List.of("evt-a", "evt-b"),
                    fired.stream().map(AutomaticEventFired::eventUuid).toList());
        }

        @Test
        @DisplayName("a fuse in an empty location still writes the registry — it just has nobody to change")
        void noActorStillAppliesMatchScopedEffects() {
            EventEntity e = event(50L, "evt-empty-room");
            EventEffectEntity registry = new EventEffectEntity();
            registry.setKeyToAdd("DOOR_OPEN");
            registry.setKeyValueToAdd("YES");
            when(store.findEventsById(STORY_ID)).thenReturn(Map.of(50L, e));
            when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(50L, List.of(registry)));

            List<AutomaticEventFired> fired = service.runPendingAutomaticEvents(MATCH_ID, CLOCK,
                    List.of(new PendingAutomaticEvent(LocationEntryPort.TRIGGER_COUNTER_ZERO,
                            LOCATION, 50L, null, 0)),
                    "en");

            assertEquals(1, fired.size());
            // idCharacter null: the world changed, but around no one.
            verify(store).upsertRegistry(eq(MATCH_ID), eq("DOOR_OPEN"), eq("YES"), eq(null),
                    any(), anyInt());
            verify(store, never()).updateCharacterStats(anyLong(), anyLong(), any());
        }

        @Test
        @DisplayName("an empty pending list does nothing at all")
        void emptyPendingList() {
            assertTrue(service.runPendingAutomaticEvents(MATCH_ID, CLOCK, List.of(), "en").isEmpty());
            verify(store, never()).findMatchById(anyLong());
        }
    }

    // ── fog of war ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("describeForRecipient — the telling is per person")
    class FogOfWar {

        private static final CardInfo EVENT_CARD = card("card-event", "The fuse burns out");
        private static final CardInfo EFFECT_CARD = card("card-effect", "You feel weaker");
        private static final CardInfo LOCATION_CARD = card("card-location", "The old mill");

        private final List<AutomaticEventFired> fired = List.of(
                new AutomaticEventFired(LocationEntryPort.TRIGGER_COUNTER_ZERO, LOCATION,
                        "evt-a", EVENT_CARD,
                        List.of(new EventExecutionPort.AppliedEffect("evt-a", "eff-a", "ENERGY",
                                -3, "SELF", null, List.of("char-1"), EFFECT_CARD)),
                        List.of(), List.of(), false));

        @BeforeEach
        void locationCardIsAuthored() {
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                    .thenReturn(Optional.of(triggers(null, null, null)));
            when(contentQueryPort.getCardByStoryIdAndCardId(eq(STORY_ID), eq(500), anyString()))
                    .thenReturn(LOCATION_CARD);
        }

        @Test
        @DisplayName("standing there is FULL, and all three cards are told")
        void standingThereIsFull() {
            when(locationStore.findCharacterLocation(MATCH_ID, CHAR_ID))
                    .thenReturn(Optional.of(LOCATION));
            when(locationStore.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(LOCATION));

            List<CounterZeroItem> told =
                    service.describeForRecipient(MATCH_ID, CHAR_ID, CLOCK, fired, "en");

            assertEquals(CounterZeroItem.VISIBILITY_FULL, told.get(0).visibility());
            assertEquals(CLOCK, told.get(0).clock());
            // v0.33.1: the news is the event and what it did, not the name of the place.
            assertEquals(EVENT_CARD, told.get(0).card());
            assertEquals(LOCATION_CARD, told.get(0).cardLocation());
            assertEquals(1, told.get(0).cardEffects().size());
            assertEquals(EFFECT_CARD, told.get(0).cardEffects().get(0).card());
        }

        @Test
        @DisplayName("having been there before is NAMED, and hears the same three cards")
        void havingBeenThereIsNamed() {
            when(locationStore.findCharacterLocation(MATCH_ID, CHAR_ID))
                    .thenReturn(Optional.of(90003L));
            when(locationStore.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(LOCATION, 90003L));

            List<CounterZeroItem> told =
                    service.describeForRecipient(MATCH_ID, CHAR_ID, CLOCK, fired, "en");

            assertEquals(CounterZeroItem.VISIBILITY_NAMED, told.get(0).visibility());
            assertEquals(EVENT_CARD, told.get(0).card());
            assertEquals(LOCATION_CARD, told.get(0).cardLocation());
            assertEquals(1, told.get(0).cardEffects().size());
        }

        @Test
        @DisplayName("an event with no effects at all still tells its own card")
        void noEffectsStillTellsTheEventCard() {
            when(locationStore.findCharacterLocation(MATCH_ID, CHAR_ID))
                    .thenReturn(Optional.of(LOCATION));
            when(locationStore.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(LOCATION));
            List<AutomaticEventFired> bare = List.of(
                    new AutomaticEventFired(LocationEntryPort.TRIGGER_COUNTER_ZERO, LOCATION,
                            "evt-a", EVENT_CARD, null, List.of(), List.of(), false));

            List<CounterZeroItem> told =
                    service.describeForRecipient(MATCH_ID, CHAR_ID, CLOCK, bare, "en");

            assertEquals(EVENT_CARD, told.get(0).card());
            assertTrue(told.get(0).cardEffects().isEmpty());
        }

        @Test
        @DisplayName("a place never seen is ANONYMOUS and no card of any kind leaves the server")
        void neverThereIsAnonymousAndUnnamed() {
            when(locationStore.findCharacterLocation(MATCH_ID, CHAR_ID))
                    .thenReturn(Optional.of(90003L));
            when(locationStore.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(90003L));

            List<CounterZeroItem> told =
                    service.describeForRecipient(MATCH_ID, CHAR_ID, CLOCK, fired, "en");

            assertEquals(CounterZeroItem.VISIBILITY_ANONYMOUS, told.get(0).visibility());
            assertNull(told.get(0).card(), "a name that never leaves the server cannot leak");
            assertNull(told.get(0).cardLocation());
            assertTrue(told.get(0).cardEffects().isEmpty(),
                    "the effects would describe what happened in a place the player cannot know");
            // The card is not even looked up for a place the recipient may not know about.
            verify(locationStore, never()).findLocationTriggers(STORY_ID, LOCATION);
        }

        @Test
        @DisplayName("no recipient at all yields the most cautious reading")
        void noRecipientIsAnonymous() {
            List<CounterZeroItem> told =
                    service.describeForRecipient(MATCH_ID, null, CLOCK, fired, "en");

            assertEquals(CounterZeroItem.VISIBILITY_ANONYMOUS, told.get(0).visibility());
            assertNull(told.get(0).card());
            assertNull(told.get(0).cardLocation());
            assertTrue(told.get(0).cardEffects().isEmpty());
        }

        @Test
        @DisplayName("a location with no card of its own still tells the event and its effects")
        void locationWithoutCardStillTellsTheEvent() {
            when(locationStore.findCharacterLocation(MATCH_ID, CHAR_ID))
                    .thenReturn(Optional.of(LOCATION));
            when(locationStore.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(LOCATION));
            when(locationStore.findLocationTriggers(STORY_ID, LOCATION)).thenReturn(Optional.empty());

            List<CounterZeroItem> told =
                    service.describeForRecipient(MATCH_ID, CHAR_ID, CLOCK, fired, "en");

            assertNull(told.get(0).cardLocation());
            assertEquals(EVENT_CARD, told.get(0).card());
            assertEquals(1, told.get(0).cardEffects().size());
        }

        @Test
        @DisplayName("nothing fired, nothing told")
        void emptyInEmptyOut() {
            assertTrue(service.describeForRecipient(MATCH_ID, CHAR_ID, CLOCK, List.of(), "en")
                    .isEmpty());
        }
    }

    @Test
    @DisplayName("without a location store the engine is exactly as it was before Step 33")
    void noLocationStoreIsAPreStep33Engine() {
        EventExecutionService legacy = new EventExecutionService(store, edgeStore,
                mock(UserAccessPort.class), mock(ContentQueryPort.class), null);

        assertTrue(legacy.onArrival(arrival()).isEmpty());
        assertTrue(legacy.runPendingAutomaticEvents(MATCH_ID, CLOCK,
                List.of(new PendingAutomaticEvent("COUNTER_ZERO", LOCATION, 50L, null, 0)),
                "en").isEmpty());
        verify(store, never()).findEventsById(anyLong());
    }

    @Test
    @DisplayName("a match that is not RUNNING fires nothing")
    void nonRunningMatchFiresNothing() {
        when(store.findMatchById(MATCH_ID)).thenReturn(Optional.of(
                new MatchEventView(MATCH_ID, "m1", "PAUSED", CLOCK, STORY_ID, 3L, null)));
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(40L, event(40L, "evt-first")));
        when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                .thenReturn(Optional.of(triggers(40, null, null)));

        assertTrue(service.onArrival(arrival()).isEmpty());
    }

    @Test
    @DisplayName("the audit row carries the trigger, the location and the clock")
    void auditRowIsWritten() {
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(40L, event(40L, "evt-first")));
        when(locationStore.findLocationTriggers(STORY_ID, LOCATION))
                .thenReturn(Optional.of(triggers(40, null, null)));

        service.onArrival(arrival());

        verify(locationStore, times(1)).logAutomaticEvent(eq(MATCH_ID), eq(CHAR_ID), eq(LOCATION),
                eq(40L), eq(CLOCK), anyString());
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static ArrivalContext arrival() {
        return new ArrivalContext(MATCH_ID, STORY_ID, CHAR_ID, LOCATION, CLOCK, "en");
    }

    private static LocationTriggerView triggers(Integer first, Integer notFirst, Integer alone) {
        return new LocationTriggerView(LOCATION, 500, first, notFirst, alone, null, null, 0);
    }

    /** A card with just the two fields the assertions care about. */
    private static CardInfo card(String uuid, String title) {
        return new CardInfo(uuid, "EVENT", null, null, null, null, null, null, null, null,
                title, null, null, null, null);
    }

    private static EventEntity event(long id, String uuid) {
        EventEntity e = new EventEntity();
        e.setId(id);
        e.setUuid(uuid);
        e.setType("AUTOMATIC");
        return e;
    }

    private static EventEffectEntity lethalEffect() {
        EventEffectEntity e = new EventEffectEntity();
        e.setStatistics("life");
        e.setValue(-99);
        e.setTarget("ONLY_ONE");
        return e;
    }

    private static EventEffectEntity moveEffect(int idLocation) {
        EventEffectEntity e = new EventEffectEntity();
        e.setIdLocation(idLocation);
        e.setTarget("ONLY_ONE");
        return e;
    }

    private static EventActorView actor() {
        return actorAt(LOCATION);
    }

    private static EventActorView actorAt(long idLocation) {
        return new EventActorView(CHAR_ID, "char-1", 3L, null, idLocation,
                5, 5, 5, 10, 10, 0, 0, 20, 20, 50, 30, false, false, null);
    }

    private static EventCheckContext context(Long idCharacter) {
        if (idCharacter == null) {
            return EventCheckContext.noCharacter();
        }
        return new EventCheckContext(idCharacter, LOCATION, false, false, 10, 0, null,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }

    @Test
    @DisplayName("the arrival context carries what the engine needs and nothing else")
    void arrivalContextShape() {
        ArrivalContext a = arrival();
        assertEquals(MATCH_ID, a.idMatch());
        assertEquals(STORY_ID, a.idStory());
        assertEquals(CHAR_ID, a.idCharacter());
        assertEquals(LOCATION, a.idLocation());
        assertEquals(CLOCK, a.currentClock());
        assertNotNull(a.lang());
    }
}
