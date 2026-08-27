package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateLocationsEntityId;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.match.LogMovementEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.port.match.LocationEntryStorePort.LocationTriggerView;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Step 33 - unit tests of the JPA adapter behind {@code LocationEntryStorePort}.
 */
class LocationEntryStoreAdapterTest {

    private GamingStateLocationsRepository stateLocationsRepository;
    private GamingCharacterInstanceRepository characterRepository;
    private LogEventsRepository logEventsRepository;
    private LogMovementRepository logMovementRepository;
    private StoryReadPort storyReadPort;
    private LocationEntryStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        stateLocationsRepository = mock(GamingStateLocationsRepository.class);
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        logMovementRepository = mock(LogMovementRepository.class);
        storyReadPort = mock(StoryReadPort.class);
        adapter = new LocationEntryStoreAdapter(stateLocationsRepository, characterRepository,
                logEventsRepository, logMovementRepository, storyReadPort);
    }

    private static LocationEntity location(Long id) {
        LocationEntity l = new LocationEntity();
        l.setId(id);
        return l;
    }

    private static GamingCharacterInstanceEntity character(Long id, Long idLocation) {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(id);
        c.setIdLocation(idLocation);
        return c;
    }

    private static GamingStateLocationsEntity state(long idMatch, long idLocation, Integer flagVisited) {
        GamingStateLocationsEntity s = new GamingStateLocationsEntity();
        s.setIdMatch(idMatch);
        s.setIdLocation(idLocation);
        s.setFlagVisited(flagVisited);
        return s;
    }

    private static LogMovementEntity movement(Long from, Long to) {
        LogMovementEntity m = new LogMovementEntity();
        m.setIdLocationFrom(from);
        m.setIdLocationTo(to);
        return m;
    }

    // === findLocationTriggers ===

    @Test
    void findLocationTriggersMapsEveryTriggerColumn() {
        LocationEntity l = location(7L);
        l.setIdCard(11);
        l.setIdEventIfFirstTime(21);
        l.setIdEventNotFirstTime(22);
        l.setIdEventIfCharacterEnterEmptyLocation(23);
        l.setIdEventIfCharacterStartTime(24);
        l.setIdEventIfCounterZero(25);
        l.setPriorityAutomaticEvent(3);
        when(storyReadPort.findLocationsByStoryId(5L)).thenReturn(List.of(location(6L), l));

        LocationTriggerView view = adapter.findLocationTriggers(5L, 7L).orElseThrow();

        assertEquals(7L, view.idLocation());
        assertEquals(11, view.idCard());
        assertEquals(21, view.idEventIfFirstTime());
        assertEquals(22, view.idEventNotFirstTime());
        assertEquals(23, view.idEventIfCharacterEnterEmptyLocation());
        assertEquals(24, view.idEventIfCharacterStartTime());
        assertEquals(25, view.idEventIfCounterZero());
        assertEquals(3, view.priorityAutomaticEvent());
    }

    @Test
    void findLocationTriggersIsEmptyWhenNoLocationMatches() {
        when(storyReadPort.findLocationsByStoryId(5L)).thenReturn(List.of(location(6L)));
        assertTrue(adapter.findLocationTriggers(5L, 7L).isEmpty());
    }

    @Test
    void findLocationTriggersSkipsRowsWithoutId() {
        when(storyReadPort.findLocationsByStoryId(5L)).thenReturn(List.of(location(null)));
        assertTrue(adapter.findLocationTriggers(5L, 7L).isEmpty());
    }

    // === findFlagVisited ===

    @Test
    void findFlagVisitedReturnsTheStoredLatch() {
        when(stateLocationsRepository.findById(new GamingStateLocationsEntityId(1L, 2L)))
                .thenReturn(Optional.of(state(1L, 2L, 1)));
        assertEquals(1, adapter.findFlagVisited(1L, 2L));
    }

    @Test
    void findFlagVisitedTreatsANullLatchAsZero() {
        when(stateLocationsRepository.findById(any()))
                .thenReturn(Optional.of(state(1L, 2L, null)));
        assertEquals(0, adapter.findFlagVisited(1L, 2L));
    }

    @Test
    void findFlagVisitedIsZeroWhenNoRowExists() {
        when(stateLocationsRepository.findById(any())).thenReturn(Optional.empty());
        assertEquals(0, adapter.findFlagVisited(1L, 2L));
    }

    // === markStateLocationVisited ===

    @Test
    void markStateLocationVisitedLatchesTheRow() {
        GamingStateLocationsEntity s = state(1L, 2L, 0);
        when(stateLocationsRepository.findById(any())).thenReturn(Optional.of(s));

        adapter.markStateLocationVisited(1L, 2L);

        assertEquals(1, s.getFlagVisited());
        verify(stateLocationsRepository).save(s);
    }

    @Test
    void markStateLocationVisitedIsIdempotent() {
        when(stateLocationsRepository.findById(any())).thenReturn(Optional.of(state(1L, 2L, 1)));

        adapter.markStateLocationVisited(1L, 2L);

        verify(stateLocationsRepository, never()).save(any());
    }

    @Test
    void markStateLocationVisitedDoesNothingWithoutARow() {
        when(stateLocationsRepository.findById(any())).thenReturn(Optional.empty());

        adapter.markStateLocationVisited(1L, 2L);

        verify(stateLocationsRepository, never()).save(any());
    }

    // === countOtherCharactersAtLocation ===

    @Test
    void countOtherCharactersSkipsTheMoverNullIdsAndOtherLocations() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(
                character(10L, 2L),   // the mover itself → skipped
                character(null, 2L),  // no id → skipped
                character(11L, null), // nowhere → skipped
                character(12L, 3L),   // elsewhere → skipped
                character(13L, 2L),
                character(14L, 2L)));

        assertEquals(2, adapter.countOtherCharactersAtLocation(1L, 2L, 10L));
    }

    @Test
    void countOtherCharactersIsZeroOnAnEmptyMatch() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of());
        assertEquals(0, adapter.countOtherCharactersAtLocation(1L, 2L, 10L));
    }

    // === findNominalActorAtLocation ===

    @Test
    void findNominalActorReturnsTheLowestIdStandingThere() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(
                character(null, 2L),  // no id → skipped
                character(20L, null), // nowhere → skipped
                character(21L, 3L),   // elsewhere → skipped
                character(30L, 2L),
                character(25L, 2L),
                character(40L, 2L)));

        assertEquals(25L, adapter.findNominalActorAtLocation(1L, 2L).orElseThrow());
    }

    @Test
    void findNominalActorIsEmptyWhenNobodyIsThere() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(character(30L, 9L)));
        assertTrue(adapter.findNominalActorAtLocation(1L, 2L).isEmpty());
    }

    // === logAutomaticEvent ===

    @Test
    void logAutomaticEventAppendsARowWithTheNextId() {
        when(logEventsRepository.findMaxId()).thenReturn(41L);

        adapter.logAutomaticEvent(1L, 9L, 2L, 77L, 5, "automatic event 77");

        ArgumentCaptor<LogEventsEntity> captor = ArgumentCaptor.forClass(LogEventsEntity.class);
        verify(logEventsRepository).save(captor.capture());
        LogEventsEntity e = captor.getValue();
        assertEquals(42L, e.getId());
        assertEquals(1L, e.getIdMatch());
        assertEquals(9L, e.getIdCharacterMatch());
        assertEquals(2L, e.getIdLocation());
        assertEquals(77L, e.getIdEvent());
        assertEquals(5, e.getClock());
        assertEquals("automatic event 77", e.getLogMessage());
    }

    @Test
    void logAutomaticEventAcceptsANullCharacterAndClock() {
        when(logEventsRepository.findMaxId()).thenReturn(0L);

        adapter.logAutomaticEvent(1L, null, 2L, null, null, "counter zero");

        ArgumentCaptor<LogEventsEntity> captor = ArgumentCaptor.forClass(LogEventsEntity.class);
        verify(logEventsRepository).save(captor.capture());
        assertEquals(1L, captor.getValue().getId());
        assertNull(captor.getValue().getIdCharacterMatch());
        assertNull(captor.getValue().getIdEvent());
        assertNull(captor.getValue().getClock());
    }

    // === findVisitedLocationIds ===

    @Test
    void findVisitedLocationIdsUnionsPositionsAndMovementEndpointsWithoutDuplicates() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(
                character(10L, 5L), character(11L, null), character(12L, 5L)));
        when(logMovementRepository.findByIdMatch(1L)).thenReturn(List.of(
                movement(3L, 5L), movement(null, 7L), movement(7L, null)));

        assertEquals(List.of(5L, 3L, 7L), adapter.findVisitedLocationIds(1L));
    }

    @Test
    void findVisitedLocationIdsIsEmptyWhenNothingHappenedYet() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of());
        when(logMovementRepository.findByIdMatch(1L)).thenReturn(List.of());
        assertTrue(adapter.findVisitedLocationIds(1L).isEmpty());
    }

    // === findCharacterLocation ===

    @Test
    void findCharacterLocationReturnsWhereTheCharacterStands() {
        when(characterRepository.findByIdMatchAndId(1L, 10L))
                .thenReturn(Optional.of(character(10L, 4L)));
        assertEquals(4L, adapter.findCharacterLocation(1L, 10L).orElseThrow());
    }

    @Test
    void findCharacterLocationIsEmptyForAnUnknownCharacter() {
        when(characterRepository.findByIdMatchAndId(1L, 10L)).thenReturn(Optional.empty());
        assertTrue(adapter.findCharacterLocation(1L, 10L).isEmpty());
    }
}
