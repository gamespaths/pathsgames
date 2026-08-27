package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntityId;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateLocationsEntityId;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.story.ClassBonusEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.port.match.RecoveryStorePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;
import games.paths.core.repository.match.LogEventsRepository;

import org.junit.jupiter.api.BeforeEach;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RecoveryStoreAdapterTest {

    private GamingMatchRepository matchRepository;
    private GamingCharacterInstanceRepository characterRepository;
    private GamingStateLocationsRepository stateLocationsRepository;
    private LogEventsRepository logEventsRepository;
    private StoryReadPort storyReadPort;
    private RecoveryStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        stateLocationsRepository = mock(GamingStateLocationsRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        storyReadPort = mock(StoryReadPort.class);
        adapter = new RecoveryStoreAdapter(
                matchRepository, characterRepository, stateLocationsRepository,
                logEventsRepository, storyReadPort);
    }

    // ─── loadContext ────────────────────────────────────────────────────────

    @Test
    void loadContext_matchNotFound_empty() {
        when(matchRepository.findById(1L)).thenReturn(Optional.empty());
        assertTrue(adapter.loadContext(1L).isEmpty());
    }

    @Test
    void loadContext_matchHasNoStory_empty() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setIdStory(null);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));
        assertTrue(adapter.loadContext(1L).isEmpty());
    }

    @Test
    void loadContext_noDifficulty_zeroEnergy() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setIdStory(10L);
        m.setIdDifficulty(null);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));

        Optional<RecoveryStorePort.RecoveryMatchContext> result = adapter.loadContext(1L);

        assertTrue(result.isPresent());
        assertEquals(10L, result.get().idStory());
        assertEquals(0, result.get().difficultyEnergy());
    }

    @Test
    void loadContext_withMatchingDifficulty_returnsEnergy() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setIdStory(10L);
        m.setIdDifficulty(5L);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));

        StoryDifficultyEntity d = new StoryDifficultyEntity();
        d.setId(5L);
        d.setEnergy(20);
        when(storyReadPort.findDifficultiesByStoryId(10L)).thenReturn(List.of(d));

        Optional<RecoveryStorePort.RecoveryMatchContext> result = adapter.loadContext(1L);

        assertTrue(result.isPresent());
        assertEquals(20, result.get().difficultyEnergy());
    }

    @Test
    void loadContext_difficultyNotMatching_zeroEnergy() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setIdStory(10L);
        m.setIdDifficulty(5L);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(m));

        StoryDifficultyEntity d = new StoryDifficultyEntity();
        d.setId(99L);
        d.setEnergy(20);
        when(storyReadPort.findDifficultiesByStoryId(10L)).thenReturn(List.of(d));

        Optional<RecoveryStorePort.RecoveryMatchContext> result = adapter.loadContext(1L);

        assertTrue(result.isPresent());
        assertEquals(0, result.get().difficultyEnergy());
    }

    // ─── findCharacters ─────────────────────────────────────────────────────

    @Test
    void findCharacters_empty() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of());
        assertTrue(adapter.findCharacters(1L).isEmpty());
    }

    @Test
    void findCharacters_mapsFields() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(10L);
        c.setUuid("cu");
        c.setIdClass(3L);
        c.setIdLocation(7L);
        c.setDexterity(10);
        c.setIntelligence(11);
        c.setConstitution(12);
        c.setEnergy(50);
        c.setLife(100);
        c.setSad(5);
        c.setEnergyMax(60);
        c.setLifeMax(120);
        c.setSadMax(10);

        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(c));
        List<RecoveryStorePort.RecoveryCharacter> result = adapter.findCharacters(1L);

        assertEquals(1, result.size());
        RecoveryStorePort.RecoveryCharacter rc = result.get(0);
        assertEquals(10L, rc.id());
        assertEquals("cu", rc.uuid());
        assertEquals(3L, rc.idClass());
        assertEquals(7L, rc.idLocation());
        assertEquals(10, rc.dexterity());
        assertEquals(11, rc.intelligence());
        assertEquals(12, rc.constitution());
        assertEquals(50, rc.energy());
        assertEquals(100, rc.life());
        assertEquals(5, rc.sad());
        assertEquals(60, rc.energyMax());
        assertEquals(120, rc.lifeMax());
        assertEquals(10, rc.sadMax());
    }

    @Test
    void findCharacters_nullStats_defaultToZero() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(1L);
        c.setUuid("u");
        c.setIdClass(1L);
        c.setIdLocation(1L);
        // leave numeric fields null → should default to 0
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(c));

        List<RecoveryStorePort.RecoveryCharacter> result = adapter.findCharacters(1L);
        RecoveryStorePort.RecoveryCharacter rc = result.get(0);
        assertEquals(0, rc.dexterity());
        assertEquals(0, rc.energy());
        assertEquals(0, rc.life());
    }

    // ─── findLocationSafety ─────────────────────────────────────────────────

    @Test
    void findLocationSafety_mapsFields() {
        LocationEntity l = new LocationEntity();
        l.setId(5L);
        l.setSecureParam(3);
        l.setCounterTime(2);
        l.setIdEventIfCounterZero(99);
        when(storyReadPort.findLocationsByStoryId(10L)).thenReturn(List.of(l));

        List<RecoveryStorePort.LocationSafety> result = adapter.findLocationSafety(10L);
        assertEquals(1, result.size());
        assertEquals(5L, result.get(0).idLocation());
        assertEquals(3, result.get(0).secureParam());
        assertEquals(2, result.get(0).counterTime());
        assertEquals(99, result.get(0).idEventIfCounterZero());
    }

    // ─── findClassBonuses ───────────────────────────────────────────────────

    @Test
    void findClassBonuses_skipsNullIdClass() {
        ClassBonusEntity b = new ClassBonusEntity();
        b.setIdClass(null);
        when(storyReadPort.findClassBonusesByStoryId(10L)).thenReturn(List.of(b));

        assertTrue(adapter.findClassBonuses(10L).isEmpty());
    }

    @Test
    void findClassBonuses_mapsFields() {
        ClassBonusEntity b = new ClassBonusEntity();
        b.setIdClass(3);
        b.setStatistic("energy");
        b.setValue(5);
        when(storyReadPort.findClassBonusesByStoryId(10L)).thenReturn(List.of(b));

        List<RecoveryStorePort.ClassBonusView> result = adapter.findClassBonuses(10L);
        assertEquals(1, result.size());
        assertEquals(3L, result.get(0).idClass());
        assertEquals("energy", result.get(0).statistic());
        assertEquals(5, result.get(0).value());
    }

    // ─── findStateLocations ─────────────────────────────────────────────────

    @Test
    void findStateLocations_mapsFields() {
        GamingStateLocationsEntity s = new GamingStateLocationsEntity();
        s.setIdLocation(7L);
        s.setClockCounter(3);
        s.setFlagAlreadyActived(1);
        when(stateLocationsRepository.findByIdMatch(1L)).thenReturn(List.of(s));

        List<RecoveryStorePort.StateLocationView> result = adapter.findStateLocations(1L);
        assertEquals(1, result.size());
        assertEquals(7L, result.get(0).idLocation());
        assertEquals(3, result.get(0).clockCounter());
        assertEquals(1, result.get(0).flagAlreadyActived());
    }

    @Test
    void markStateLocationActivated_setsFlag() {
        GamingStateLocationsEntity s = new GamingStateLocationsEntity();
        s.setIdMatch(1L);
        s.setIdLocation(7L);
        s.setFlagAlreadyActived(0);
        when(stateLocationsRepository.findById(new games.paths.core.entity.match.GamingStateLocationsEntityId(1L, 7L)))
                .thenReturn(Optional.of(s));

        adapter.markStateLocationActivated(1L, 7L);

        assertEquals(1, s.getFlagAlreadyActived());
        verify(stateLocationsRepository).save(s);
    }

    // ─── updateCharacterStats ───────────────────────────────────────────────

    @Test
    void updateCharacterStats_entityPresent_saves() {
        GamingCharacterInstanceEntity entity = new GamingCharacterInstanceEntity();
        when(characterRepository.findById(new GamingCharacterInstanceEntityId(2L, 1L)))
                .thenReturn(Optional.of(entity));

        adapter.updateCharacterStats(1L, 2L, 30, 80, 5);

        assertEquals(30, entity.getEnergy());
        assertEquals(80, entity.getLife());
        assertEquals(5, entity.getSad());
        verify(characterRepository).save(entity);
    }

    @Test
    void updateCharacterStats_entityAbsent_noSave() {
        when(characterRepository.findById(any())).thenReturn(Optional.empty());
        adapter.updateCharacterStats(1L, 2L, 30, 80, 5);
        verify(characterRepository, never()).save(any());
    }

    // ─── insertStateLocation ────────────────────────────────────────────────

    @Test
    void insertStateLocation_savesEntity() {
        adapter.insertStateLocation(1L, 7L, 3);
        verify(stateLocationsRepository).save(any(GamingStateLocationsEntity.class));
    }

    // ─── updateStateLocationCounter ─────────────────────────────────────────

    @Test
    void updateStateLocationCounter_entityPresent_updates() {
        GamingStateLocationsEntity entity = new GamingStateLocationsEntity();
        when(stateLocationsRepository.findById(new GamingStateLocationsEntityId(1L, 7L)))
                .thenReturn(Optional.of(entity));

        adapter.updateStateLocationCounter(1L, 7L, 5);

        assertEquals(5, entity.getClockCounter());
        verify(stateLocationsRepository).save(entity);
    }

    @Test
    void updateStateLocationCounter_entityAbsent_noSave() {
        when(stateLocationsRepository.findById(any())).thenReturn(Optional.empty());
        adapter.updateStateLocationCounter(1L, 7L, 5);
        verify(stateLocationsRepository, never()).save(any());
    }

    // ─── logRecovery ────────────────────────────────────────────────────────

    @Test
    void logRecovery_savesLogEvent() {
        when(logEventsRepository.findMaxId()).thenReturn(100L);
        adapter.logRecovery(1L, 2L, "recovered");
        verify(logEventsRepository).save(any());
    }

    // ─── logCounterZero ─────────────────────────────────────────────────────

    @Test
    void logCounterZero_withNullEvent_savesLogEvent() {
        when(logEventsRepository.findMaxId()).thenReturn(50L);
        adapter.logCounterZero(1L, 7L, null, 4, "counter zero");
        verify(logEventsRepository).save(any());
    }

    @Test
    void logCounterZero_withEvent_savesLogEvent() {
        when(logEventsRepository.findMaxId()).thenReturn(50L);
        adapter.logCounterZero(1L, 7L, 99, 4, "counter zero with event");
        verify(logEventsRepository).save(any());
    }

    /**
     * Step 33 bug fix: the row used to leave {@code clock} NULL — unlike {@code logSleep} —
     * so it landed outside the clock-ordered timeline, and the location existed only inside
     * the message string. Both are columns now.
     */
    @Test
    void logCounterZero_stampsTheClockAndTheLocation() {
        when(logEventsRepository.findMaxId()).thenReturn(50L);
        ArgumentCaptor<LogEventsEntity> saved = ArgumentCaptor.forClass(LogEventsEntity.class);

        adapter.logCounterZero(1L, 7L, 99, 12, "counter reached zero at location 7");

        verify(logEventsRepository).save(saved.capture());
        assertEquals(12, saved.getValue().getClock());
        assertEquals(7L, saved.getValue().getIdLocation());
        assertEquals(99L, saved.getValue().getIdEvent());
    }
}
