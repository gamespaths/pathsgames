package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.GlobalRandomEventEntity;
import games.paths.core.port.match.RandomEventStorePort.RandomEventMatchContext;
import games.paths.core.port.match.RandomEventStorePort.RandomEventRuleView;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogEventsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RandomEventStoreAdapterTest {

    private GamingMatchRepository matchRepository;
    private StoryReadPort storyReadPort;
    private LogEventsRepository logEventsRepository;
    private RandomEventStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        storyReadPort = mock(StoryReadPort.class);
        logEventsRepository = mock(LogEventsRepository.class);
        adapter = new RandomEventStoreAdapter(matchRepository, storyReadPort, logEventsRepository);
    }

    private static GlobalRandomEventEntity row(long id, Integer idEvent, Integer probability) {
        GlobalRandomEventEntity r = new GlobalRandomEventEntity();
        r.setId(id);
        r.setIdEvent(idEvent);
        r.setProbability(probability);
        r.setConditionKey("k");
        r.setConditionValue("v");
        r.setRegistryValueOperatorCondition("!=");
        return r;
    }

    private static EventEntity event(long id, String type) {
        EventEntity e = new EventEntity();
        e.setId(id);
        e.setType(type);
        return e;
    }

    @Test
    void loadContext_readsTheMatch() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(1L);
        m.setIdStory(7L);
        m.setCurrentClock(3);
        m.setRngSeed(42L);
        m.setStatus("RUNNING");
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        assertEquals(new RandomEventMatchContext(7L, 3, 42L, "RUNNING"), adapter.loadContext(1L).orElseThrow());
    }

    @Test
    void loadContext_nullClockReadsZero() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(1L);
        m.setIdStory(7L);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        assertEquals(0, adapter.loadContext(1L).orElseThrow().currentClock());
    }

    @Test
    void loadContext_emptyWhenMatchOrStoryMissing() {
        when(matchRepository.findById(1L)).thenReturn(Optional.empty());
        assertTrue(adapter.loadContext(1L).isEmpty());
        when(matchRepository.findById(2L)).thenReturn(Optional.of(new GamingMatchEntity()));
        assertTrue(adapter.loadContext(2L).isEmpty());
    }

    @Test
    void findRandomEvents_joinsEventTypeAndChoices() {
        ChoiceEntity choice = new ChoiceEntity();
        choice.setIdEvent(12);
        ChoiceEntity orphan = new ChoiceEntity();
        when(storyReadPort.findGlobalRandomEventsByStoryId(7L)).thenReturn(List.of(
                row(1, 11, 30), row(2, 12, 20), row(3, 99, null), row(4, null, 5)));
        when(storyReadPort.findEventsByStoryId(7L)).thenReturn(List.of(event(11, "ONCE"), event(12, "AUTOMATIC")));
        when(storyReadPort.findChoicesByStoryId(7L)).thenReturn(List.of(choice, orphan));

        List<RandomEventRuleView> out = adapter.findRandomEvents(7L);

        assertEquals(new RandomEventRuleView(1, 11, 30, "k", "v", "!=", true, "ONCE", false), out.get(0));
        assertTrue(out.get(1).eventOwnsChoices());
        assertEquals(new RandomEventRuleView(3, 99, 0, "k", "v", "!=", false, null, false), out.get(2));
        assertFalse(out.get(3).eventExists());
    }

    @Test
    void findRandomEvents_emptyStorySkipsTheJoins() {
        when(storyReadPort.findGlobalRandomEventsByStoryId(7L)).thenReturn(List.of());
        assertTrue(adapter.findRandomEvents(7L).isEmpty());
        when(storyReadPort.findGlobalRandomEventsByStoryId(8L)).thenReturn(null);
        assertTrue(adapter.findRandomEvents(8L).isEmpty());
        verify(storyReadPort, never()).findEventsByStoryId(anyLong());
    }

    @Test
    void findConsumedEventIds_readsOnlyExecutedMarkers() {
        LogEventsEntity executed = new LogEventsEntity();
        executed.setLogMessage("EVENT_EXECUTED 11");
        executed.setIdEvent(11L);
        LogEventsEntity weather = new LogEventsEntity();
        weather.setLogMessage("weather event");
        weather.setIdEvent(12L);
        when(logEventsRepository.findByIdMatchOrderByIdAsc(1L)).thenReturn(List.of(executed, weather));
        assertEquals(Set.of(11L), adapter.findConsumedEventIds(1L));
    }
}
