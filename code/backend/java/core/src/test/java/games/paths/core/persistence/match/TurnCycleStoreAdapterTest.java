package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntityId;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingTurnQueueEntity;
import games.paths.core.entity.match.LogClockHistoryEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.port.match.TurnCycleStorePort.CharacterTurnView;
import games.paths.core.port.match.TurnCycleStorePort.ClockLabels;
import games.paths.core.port.match.TurnCycleStorePort.MatchView;
import games.paths.core.port.match.TurnCycleStorePort.QueueRow;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingTurnQueueRepository;
import games.paths.core.repository.match.LogClockHistoryRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.story.StoryRepository;
import games.paths.core.repository.story.TextRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class TurnCycleStoreAdapterTest {

    private GamingMatchRepository matchRepository;
    private GamingCharacterInstanceRepository characterRepository;
    private GamingTurnQueueRepository turnQueueRepository;
    private LogClockHistoryRepository logClockHistoryRepository;
    private LogEventsRepository logEventsRepository;
    private StoryRepository storyRepository;
    private TextRepository textRepository;
    private TurnCycleStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        turnQueueRepository = mock(GamingTurnQueueRepository.class);
        logClockHistoryRepository = mock(LogClockHistoryRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        storyRepository = mock(StoryRepository.class);
        textRepository = mock(TextRepository.class);
        adapter = new TurnCycleStoreAdapter(matchRepository, characterRepository, turnQueueRepository,
                logClockHistoryRepository, logEventsRepository, storyRepository, textRepository);
    }

    private GamingMatchEntity match() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(1L);
        m.setUuid("match-uuid");
        m.setStatus("RUNNING");
        m.setCurrentClock(2);
        m.setIdUserCreator(7L);
        m.setIdStory(5L);
        return m;
    }

    private GamingCharacterInstanceEntity character() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(10L);
        c.setUuid("char-uuid");
        c.setIdUser(7L);
        c.setDexterity(1);
        c.setIntelligence(2);
        c.setConstitution(3);
        c.setLife(4);
        c.setEnergy(5);
        c.setIsSleeping(true);
        return c;
    }

    @Test
    void findMatchByUuid_mapsToView() {
        when(matchRepository.findByUuid("match-uuid")).thenReturn(Optional.of(match()));
        Optional<MatchView> view = adapter.findMatchByUuid("match-uuid");
        assertTrue(view.isPresent());
        assertEquals("match-uuid", view.get().uuid());
        assertEquals(2, view.get().currentClock());

        when(matchRepository.findByUuid("nope")).thenReturn(Optional.empty());
        assertTrue(adapter.findMatchByUuid("nope").isEmpty());
    }

    @Test
    void findCharactersByMatchId_mapsAll() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(character()));
        List<CharacterTurnView> out = adapter.findCharactersByMatchId(1L);
        assertEquals(1, out.size());
        assertEquals("char-uuid", out.get(0).uuid());
        assertTrue(out.get(0).isSleeping());
    }

    @Test
    void replaceQueue_deletesThenSaves() {
        QueueRow row = new QueueRow(10L, "q", 2, 9L, "WAITING", 0, null, null);
        adapter.replaceQueue(1L, List.of(row));
        verify(turnQueueRepository).deleteByIdMatch(1L);
        verify(turnQueueRepository).saveAll(anyList());
    }

    @Test
    void findQueueByMatchId_mapsRows() {
        GamingTurnQueueEntity e = new GamingTurnQueueEntity();
        e.setIdCharacterMatch(10L);
        e.setUuid("q");
        e.setClock(2);
        e.setPriority(9L);
        e.setStatus("ACTIVE");
        e.setPassCounter(1);
        when(turnQueueRepository.findByIdMatchOrderByPriorityDesc(1L)).thenReturn(List.of(e));
        List<QueueRow> rows = adapter.findQueueByMatchId(1L);
        assertEquals(1, rows.size());
        assertEquals(9L, rows.get(0).priority());
    }

    @Test
    void saveQueueRow_updatesExisting_andNoOpWhenMissing() {
        GamingTurnQueueEntity e = new GamingTurnQueueEntity();
        e.setIdMatch(1L);
        e.setIdCharacterMatch(10L);
        when(turnQueueRepository.findByIdMatchAndIdCharacterMatch(1L, 10L)).thenReturn(Optional.of(e));
        adapter.saveQueueRow(1L, new QueueRow(10L, "q", 2, 9L, "DONE", 3, null, null));
        verify(turnQueueRepository).save(e);
        assertEquals("DONE", e.getStatus());

        when(turnQueueRepository.findByIdMatchAndIdCharacterMatch(1L, 99L)).thenReturn(Optional.empty());
        adapter.saveQueueRow(1L, new QueueRow(99L, "q", 0, 0L, "X", 0, null, null));
        verify(turnQueueRepository, never()).save(argThat(x -> x.getIdCharacterMatch() == 99L));
    }

    @Test
    void updateMatchStatusAndTurn_updatesWhenPresent_andNoOpWhenMissing() {
        GamingMatchEntity m = match();
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        adapter.updateMatchStatusAndTurn(1L, "PAUSED", 10L);
        assertEquals("PAUSED", m.getStatus());
        verify(matchRepository).save(m);

        when(matchRepository.findById(2L)).thenReturn(Optional.empty());
        adapter.updateMatchStatusAndTurn(2L, "X", null);  // no exception
    }

    @Test
    void findCharacterByMatchAndUser_maps() {
        when(characterRepository.findByIdMatchAndIdUser(1L, 7L)).thenReturn(Optional.of(character()));
        assertTrue(adapter.findCharacterByMatchAndUser(1L, 7L).isPresent());
    }

    @Test
    void setCharacterSleeping_updatesWhenPresent() {
        GamingCharacterInstanceEntity c = character();
        when(characterRepository.findById(any(GamingCharacterInstanceEntityId.class)))
                .thenReturn(Optional.of(c));
        adapter.setCharacterSleeping(1L, 10L, false);
        assertFalse(c.getIsSleeping());
        verify(characterRepository).save(c);
    }

    @Test
    void wakeAllCharacters_clearsSleepingFlags() {
        GamingCharacterInstanceEntity c = character();  // sleeping
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(c));
        adapter.wakeAllCharacters(1L);
        assertFalse(c.getIsSleeping());
        verify(characterRepository).saveAll(anyList());
    }

    @Test
    void incrementMatchClock_incrementsOrZero() {
        GamingMatchEntity m = match();
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        assertEquals(3, adapter.incrementMatchClock(1L));

        when(matchRepository.findById(2L)).thenReturn(Optional.empty());
        assertEquals(0, adapter.incrementMatchClock(2L));
    }

    @Test
    void insertClockHistory_savesWithNextId() {
        when(logClockHistoryRepository.findMaxId()).thenReturn(4L);
        adapter.insertClockHistory(1L, 5);
        verify(logClockHistoryRepository).save(any(LogClockHistoryEntity.class));
    }

    @Test
    void logSleep_savesEventWithNextIdAndClock() {
        when(logEventsRepository.findMaxId()).thenReturn(7L);
        adapter.logSleep(1L, 10L, 3);

        ArgumentCaptor<LogEventsEntity> captor = ArgumentCaptor.forClass(LogEventsEntity.class);
        verify(logEventsRepository).save(captor.capture());
        LogEventsEntity saved = captor.getValue();
        assertEquals(8L, saved.getId());
        assertEquals(1L, saved.getIdMatch());
        assertEquals(10L, saved.getIdCharacterMatch());
        assertEquals(3, saved.getClock());
        assertEquals("ACTION_SLEEP", saved.getLogMessage());
    }

    @Test
    void findStoryClockLabels_resolvesWithFallback() {
        GamingMatchEntity m = match();
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        StoryEntity story = new StoryEntity();
        story.setId(5L);
        story.setIdTextClockSingular(10);
        story.setIdTextClockPlural(11);
        when(storyRepository.findById(5L)).thenReturn(Optional.of(story));

        TextEntity en = new TextEntity();
        en.setShortText("hour");
        when(textRepository.findByIdStoryAndIdTextAndLang(5L, 10, "it")).thenReturn(List.of());
        when(textRepository.findByIdStoryAndIdTextAndLang(5L, 10, "en")).thenReturn(List.of(en));
        TextEntity enP = new TextEntity();
        enP.setShortText("hours");
        when(textRepository.findByIdStoryAndIdTextAndLang(5L, 11, "it")).thenReturn(List.of());
        when(textRepository.findByIdStoryAndIdTextAndLang(5L, 11, "en")).thenReturn(List.of(enP));

        ClockLabels labels = adapter.findStoryClockLabels(1L, "it");
        assertEquals("hour", labels.singular());
        assertEquals("hours", labels.plural());
    }

    @Test
    void findStoryClockLabels_returnsNullsWhenMatchOrStoryMissing() {
        when(matchRepository.findById(9L)).thenReturn(Optional.empty());
        ClockLabels none = adapter.findStoryClockLabels(9L, "en");
        assertNull(none.singular());
        assertNull(none.plural());
    }

    @Test
    void findStoryClockLabels_returnsNullsWhenTheStoryRowIsGone() {
        when(matchRepository.findById(1L)).thenReturn(Optional.of(match()));
        when(storyRepository.findById(5L)).thenReturn(Optional.empty());

        ClockLabels none = adapter.findStoryClockLabels(1L, "en");

        assertNull(none.singular());
        assertNull(none.plural());
    }

    @Test
    void findStoryClockLabels_blankLangFallsBackToEnglishAndUnsetTextsStayNull() {
        when(matchRepository.findById(1L)).thenReturn(Optional.of(match()));
        StoryEntity story = new StoryEntity();
        story.setId(5L);
        story.setIdTextClockSingular(10);
        story.setIdTextClockPlural(null); // no plural authored
        when(storyRepository.findById(5L)).thenReturn(Optional.of(story));
        TextEntity en = new TextEntity();
        en.setShortText("hour");
        when(textRepository.findByIdStoryAndIdTextAndLang(5L, 10, "en")).thenReturn(List.of(en));

        ClockLabels labels = adapter.findStoryClockLabels(1L, "  ");

        assertEquals("hour", labels.singular());
        assertNull(labels.plural());
    }

    @Test
    void findMatchByUuid_nullClockCountsAsZero() {
        GamingMatchEntity m = match();
        m.setCurrentClock(null);
        when(matchRepository.findByUuid("match-uuid")).thenReturn(Optional.of(m));

        assertEquals(0, adapter.findMatchByUuid("match-uuid").orElseThrow().currentClock());
    }

    @Test
    void findQueueByMatchId_nullPriorityAndClockCountAsZero() {
        GamingTurnQueueEntity e = new GamingTurnQueueEntity();
        e.setIdMatch(1L);
        e.setIdCharacterMatch(10L);
        e.setUuid("q-1");
        e.setStatus("WAITING");
        when(turnQueueRepository.findByIdMatchOrderByPriorityDesc(1L)).thenReturn(List.of(e));

        QueueRow row = adapter.findQueueByMatchId(1L).get(0);

        assertEquals(0L, row.priority());
        assertEquals(0, row.clock());
        assertEquals(0, row.passCounter());
    }

    @Test
    void updateMatchStatusAndTurn_keepsTheStatusWhenNoneIsGiven() {
        GamingMatchEntity m = match();
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));

        adapter.updateMatchStatusAndTurn(1L, null, 10L);

        assertEquals("RUNNING", m.getStatus());
        assertEquals(10L, m.getIdCharacterCurrentTurn());
        verify(matchRepository).save(m);
    }

    @Test
    void wakeAllCharacters_leavesAnAlreadyAwakeCharacterAlone() {
        GamingCharacterInstanceEntity awake = character();
        awake.setIsSleeping(false);
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(awake));

        adapter.wakeAllCharacters(1L);

        assertFalse(awake.getIsSleeping());
        verify(characterRepository).saveAll(List.of(awake));
    }

    @Test
    void setAllCharactersSleeping_putsTheWholePartyToSleep() {
        GamingCharacterInstanceEntity awake = character();
        awake.setIsSleeping(false);
        GamingCharacterInstanceEntity asleep = character();
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(awake, asleep));

        adapter.setAllCharactersSleeping(1L);

        assertTrue(awake.getIsSleeping());
        assertTrue(asleep.getIsSleeping());
        verify(characterRepository).saveAll(List.of(awake, asleep));
    }
}
