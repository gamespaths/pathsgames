package games.paths.core.service.match;

import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EdgeStateStorePort;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.EventActorView;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.EventExecutionStorePort.MatchEventView;
import games.paths.core.port.match.EventExecutionStorePort.ResourceDelta;
import games.paths.core.port.match.LocationEntryPort;
import games.paths.core.port.match.LocationEntryPort.AutomaticEventFired;
import games.paths.core.port.match.LocationEntryStorePort;
import games.paths.core.port.match.LocationEntryStorePort.LocationTriggerView;
import games.paths.core.port.match.TimeAdvancementPort;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Step 40 - forced time-end news and party-run gains on the event engine. */
@DisplayName("EventExecutionService - Step 40")
class EventExecutionServiceStep40Test {

    private static final String MATCH_UUID = "m1";
    private static final String USER_UUID = "user-uuid";
    private static final long MATCH_ID = 1L;
    private static final long USER_ID = 3L;
    private static final long STORY_ID = 9L;
    private static final long CHAR_ID = 7L;
    private static final long LOCATION = 90002L;
    private static final int CLOCK = 4;

    private EventExecutionStorePort store;
    private LocationEntryStorePort locationStore;
    private ContentQueryPort contentQueryPort;
    private TimeAdvancementService time;
    private EventExecutionService service;

    @BeforeEach
    void setUp() {
        store = mock(EventExecutionStorePort.class);
        locationStore = mock(LocationEntryStorePort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        time = mock(TimeAdvancementService.class);
        UserAccessPort users = mock(UserAccessPort.class);
        service = new EventExecutionService(store, mock(EdgeStateStorePort.class), users,
                contentQueryPort, time, locationStore, mock(RegistryService.class));

        when(users.findByUuid(USER_UUID)).thenReturn(Optional.of(
                new UserAccessPort.UserView(USER_ID, USER_UUID, "p", "USER", 2)));
        MatchEventView match = new MatchEventView(MATCH_ID, MATCH_UUID, "RUNNING", CLOCK, STORY_ID, USER_ID, null);
        when(store.findMatchById(MATCH_ID)).thenReturn(Optional.of(match));
        when(store.findMatchByUuid(MATCH_UUID)).thenReturn(Optional.of(match));
        when(store.findCharacterByMatchAndId(MATCH_ID, CHAR_ID)).thenReturn(Optional.of(actor(CHAR_ID)));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(actor(CHAR_ID)));
        when(store.loadCheckContext(eq(MATCH_ID), any())).thenAnswer(inv -> context(inv.getArgument(1)));
        when(store.findChoicesByEventId(anyLong(), anyLong())).thenReturn(List.of());
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of());
        when(store.findIdEventEndGame(STORY_ID)).thenReturn(Optional.empty());
        when(store.findIdEventAllPlayerComa(STORY_ID)).thenReturn(Optional.empty());
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(CHAR_ID)));
        when(store.findBackpack(anyLong(), anyLong())).thenReturn(Optional.empty());
    }

    // ── party-run gains ─────────────────────────────────────────────────────

    @Test
    @DisplayName("a random event logs the coins of every recipient summed on its row")
    void randomEventSumsTheParty() {
        when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(actor(CHAR_ID), actor(8L)));
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(70L, event(70L, false)));
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(70L, List.of(effect("coin", 1))));

        service.runRandomEvent(MATCH_ID, CLOCK, 70L, "en");

        verify(store).logEventExecuted(eq(MATCH_ID), isNull(), eq(70L), eq(CLOCK), anyString(),
                any(), eq(new ResourceDelta(0, 0, 0, 2)));
    }

    @Test
    @DisplayName("a mission reward logs its magic on the event row, with no actor")
    void missionLogsItsMagic() {
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(60L, event(60L, false)));
        when(store.findEffectsByEventId(STORY_ID)).thenReturn(Map.of(60L, List.of(effect("magic", 1))));

        service.runMissionEvent(MATCH_ID, 60L, 0);

        verify(store).logEventExecuted(eq(MATCH_ID), isNull(), eq(60L), eq(CLOCK), anyString(),
                any(), eq(new ResourceDelta(0, 0, 1, 0)));
    }

    // ── forced time-end news ────────────────────────────────────────────────

    @Test
    @DisplayName("execute-event with flag_end_time answers the actor's counterZero[] and the carded weather")
    void executeEventCarriesTheNews() {
        EventEntity e = event(50L, true);
        e.setType("NORMAL");
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(50L, e));
        when(store.findEventByStoryAndUuid(STORY_ID, "evt-50")).thenReturn(Optional.of(e));
        TimeAdvancementPort.CounterZeroItem item = counterZero();
        when(time.forceTimeEnd(MATCH_UUID, CHAR_ID)).thenReturn(new TimeAdvancementService.TimeEndOutcome(
                CLOCK + 1, List.of(), EventExecutionPort.EdgeStateOutcome.none(), List.of(item),
                new TimeAdvancementPort.TimeStartWeather(2L, "w2", 33, null, -1, 1, 2, false)));
        when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 33, "en")).thenReturn(card("sun"));

        EventExecutionResult r = service.executeEvent(MATCH_UUID, USER_UUID, "evt-50", "en");

        assertTrue(r.timeEnded());
        assertEquals(List.of(item), r.timeEnd().counterZero());
        assertEquals("sun", r.timeEnd().weather().card().uuid());
        assertFalse(r.timeEnd().weather().changed());
        assertEquals(CLOCK + 1, r.timeEnd().newClock());
    }

    @Test
    @DisplayName("a time-start with no weather answers a null weather and a null counterZero reads empty")
    void executeEventWithoutWeather() {
        EventEntity e = event(50L, true);
        e.setType("NORMAL");
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(50L, e));
        when(store.findEventByStoryAndUuid(STORY_ID, "evt-50")).thenReturn(Optional.of(e));
        when(time.forceTimeEnd(MATCH_UUID, CHAR_ID)).thenReturn(new TimeAdvancementService.TimeEndOutcome(
                CLOCK + 1, List.of(), EventExecutionPort.EdgeStateOutcome.none(), null, null));

        EventExecutionResult r = service.executeEvent(MATCH_UUID, USER_UUID, "evt-50", "en");

        assertNull(r.timeEnd().weather());
        assertTrue(r.timeEnd().counterZero().isEmpty());
    }

    @Test
    @DisplayName("an arrival event with flag_end_time carries the news on its fired entry")
    void arrivalCarriesTheNews() {
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(40L, event(40L, true)));
        when(locationStore.findLocationTriggers(STORY_ID, LOCATION)).thenReturn(Optional.of(
                new LocationTriggerView(LOCATION, 500, 40, null, null, null, null, 0,
                        null, null, null, null)));
        when(time.forceTimeEnd(MATCH_UUID, CHAR_ID)).thenReturn(new TimeAdvancementService.TimeEndOutcome(
                CLOCK + 1, List.of(), EventExecutionPort.EdgeStateOutcome.none(), List.of(counterZero()), null));

        List<AutomaticEventFired> fired = service.onArrival(
                new LocationEntryPort.ArrivalContext(MATCH_ID, STORY_ID, CHAR_ID, LOCATION, CLOCK, "en"));

        assertEquals(1, fired.size());
        assertNotNull(fired.get(0).timeEnd());
        assertEquals(1, fired.get(0).timeEnd().counterZero().size());
        assertEquals(CLOCK + 1, fired.get(0).timeEnd().newClock());
    }

    @Test
    @DisplayName("an automatic event that does not end the time carries no news")
    void quietArrivalHasNoNews() {
        when(store.findEventsById(STORY_ID)).thenReturn(Map.of(40L, event(40L, false)));
        when(locationStore.findLocationTriggers(STORY_ID, LOCATION)).thenReturn(Optional.of(
                new LocationTriggerView(LOCATION, 500, 40, null, null, null, null, 0,
                        null, null, null, null)));

        List<AutomaticEventFired> fired = service.onArrival(
                new LocationEntryPort.ArrivalContext(MATCH_ID, STORY_ID, CHAR_ID, LOCATION, CLOCK, "en"));

        assertNull(fired.get(0).timeEnd());
        verify(time, never()).forceTimeEnd(anyString(), any());
    }

    @Test
    @DisplayName("a movement result built without news carries a null time-end")
    void movementResultWithoutNews() {
        assertNull(new games.paths.core.port.match.MovementPort.MovementResult("m", "c", 1L, null, 2L,
                "l2", 1, 0, 0, 0, 5, 0, 0, 0, 2, List.of(),
                EventExecutionPort.EdgeStateOutcome.none()).timeEnd());
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static TimeAdvancementPort.CounterZeroItem counterZero() {
        return new TimeAdvancementPort.CounterZeroItem("COUNTER_ZERO", LOCATION, null, null,
                List.of(), "evt-cz", CLOCK + 1, "FULL");
    }

    private static CardInfo card(String uuid) {
        return new CardInfo(uuid, "WEATHER", null, null, null, null, null, null, null, null,
                "t", null, null, null, null);
    }

    private static EventEntity event(long id, boolean endTime) {
        EventEntity e = new EventEntity();
        e.setId(id);
        e.setUuid("evt-" + id);
        e.setType("AUTOMATIC");
        e.setFlagEndTime(endTime ? 1 : 0);
        return e;
    }

    private static EventEffectEntity effect(String stat, int value) {
        EventEffectEntity e = new EventEffectEntity();
        e.setStatistics(stat);
        e.setValue(value);
        e.setTarget("ALL");
        return e;
    }

    private static EventActorView actor(long id) {
        return new EventActorView(id, "char-" + id, USER_ID, null, LOCATION,
                5, 5, 5, 10, 10, 0, 0, 20, 20, 50, 30, false, false, null);
    }

    private static EventCheckContext context(Long idCharacter) {
        if (idCharacter == null) {
            return EventCheckContext.noCharacter();
        }
        return new EventCheckContext(idCharacter, LOCATION, false, false, 10, 0, null,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }
}
