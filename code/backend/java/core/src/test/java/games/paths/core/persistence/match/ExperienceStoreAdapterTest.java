package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.port.match.ExperienceStorePort.CharacterExpView;
import games.paths.core.port.match.ExperienceStorePort.DifficultyExpView;
import games.paths.core.port.match.ExperienceStorePort.MatchExpView;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.story.LocationRepository;
import games.paths.core.repository.story.StoryDifficultyRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import games.paths.core.port.match.LogIdPort;
import games.paths.core.model.match.LogTable;

/** Step 38 — the JPA adapter behind use-exp. */
class ExperienceStoreAdapterTest {

    private GamingMatchRepository matchRepository;
    private GamingCharacterInstanceRepository characterRepository;
    private LocationRepository locationRepository;
    private StoryDifficultyRepository difficultyRepository;
    private LogEventsRepository logEventsRepository;
    private LogIdPort logIds;
    private ExperienceStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        locationRepository = mock(LocationRepository.class);
        difficultyRepository = mock(StoryDifficultyRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        logIds = mock(LogIdPort.class);
        adapter = new ExperienceStoreAdapter(matchRepository, characterRepository, locationRepository,
                difficultyRepository, logEventsRepository, logIds);
    }

    @Test
    void findMatchByUuid_mapsTheView() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(1L); m.setUuid("m1"); m.setStatus("RUNNING"); m.setIdStory(5L); m.setIdDifficulty(2L);
        m.setExpCost(3); m.setCurrentClock(4); m.setIdCharacterCurrentTurn(10L);
        when(matchRepository.findByUuid("m1")).thenReturn(Optional.of(m));
        MatchExpView v = adapter.findMatchByUuid("m1").orElseThrow();
        assertEquals(new MatchExpView(1L, "m1", "RUNNING", 5L, 2L, 3, 4, 10L), v);
        assertTrue(adapter.findMatchByUuid("nope").isEmpty());
        m.setCurrentClock(null);
        assertEquals(0, adapter.findMatchByUuid("m1").orElseThrow().currentClock());
    }

    @Test
    void findCharacterByMatchAndUser_mapsTheViewWithNullsAsZero() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(10L); c.setUuid("c1"); c.setDexterity(7); c.setIsSleeping(true); c.setIdLocation(9L);
        when(characterRepository.findByIdMatchAndIdUser(1L, 100L)).thenReturn(Optional.of(c));
        CharacterExpView v = adapter.findCharacterByMatchAndUser(1L, 100L).orElseThrow();
        assertEquals(new CharacterExpView(10L, "c1", 7, 0, 0, 0, true, false, 9L), v);
        assertTrue(adapter.findCharacterByMatchAndUser(1L, 1L).isEmpty());
    }

    @Test
    void findLocationSecureParamAndDifficulty() {
        LocationEntity l = new LocationEntity();
        l.setSecureParam(2);
        when(locationRepository.findByIdStoryAndId(5L, 9L)).thenReturn(Optional.of(l));
        assertEquals(2, adapter.findLocationSecureParam(5L, 9L).orElseThrow());
        l.setSecureParam(null);
        assertEquals(0, adapter.findLocationSecureParam(5L, 9L).orElseThrow());
        assertTrue(adapter.findLocationSecureParam(5L, 1L).isEmpty());

        StoryDifficultyEntity d = new StoryDifficultyEntity();
        d.setExpCost(2); d.setExpCostBase(3); d.setMaxStatValue(12);
        when(difficultyRepository.findByIdStoryAndId(5L, 2L)).thenReturn(Optional.of(d));
        assertEquals(new DifficultyExpView(2, 3, 12), adapter.findDifficulty(5L, 2L).orElseThrow());
        assertTrue(adapter.findDifficulty(5L, 3L).isEmpty());
    }

    @Test
    void updateCharacter_writesTheFourColumnsFlooringExp() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        when(characterRepository.findByIdMatchAndId(1L, 10L)).thenReturn(Optional.of(c));
        adapter.updateCharacter(1L, 10L, 11, 12, 13, -1);
        assertEquals(11, c.getDexterity());
        assertEquals(12, c.getIntelligence());
        assertEquals(13, c.getConstitution());
        assertEquals(0, c.getExp());
        verify(characterRepository).save(c);
        adapter.updateCharacter(1L, 99L, 1, 1, 1, 1);
        verify(characterRepository, org.mockito.Mockito.times(1)).save(any());
    }

    @Test
    void logExpUse_appendsOneRow() {
        when(logIds.nextId(LogTable.EVENTS)).thenReturn(42L);
        adapter.logExpUse(1L, 10L, 3, "EXP_USE dex 10->11 cost 23");
        ArgumentCaptor<LogEventsEntity> captor = ArgumentCaptor.forClass(LogEventsEntity.class);
        verify(logEventsRepository).save(captor.capture());
        LogEventsEntity e = captor.getValue();
        assertEquals(42L, e.getId());
        assertEquals(1L, e.getIdMatch());
        assertEquals(10L, e.getIdCharacterMatch());
        assertEquals(3, e.getClock());
        assertEquals("EXP_USE dex 10->11 cost 23", e.getLogMessage());
        assertFalse(e.getLogMessage().isBlank());
    }
}
