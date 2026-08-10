package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingCharacterTraitsRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;
import games.paths.core.repository.match.GamingStateRegistryRepository;
import games.paths.core.repository.match.GamingStoryProgressRepository;
import games.paths.core.repository.match.LogChoicesExecutedRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogMovementRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MatchPersistenceAdapterTest {

    private GamingMatchRepository matchRepository;
    private GamingStateLocationsRepository locationsRepository;
    private GamingStateRegistryRepository registryRepository;
    private GamingCharacterInstanceRepository characterRepository;
    private GamingBackpackResourcesRepository backpackRepository;
    private GamingCharacterTraitsRepository characterTraitsRepository;
    private GamingInventoryItemsRepository inventoryRepository;
    private LogEventsRepository logEventsRepository;
    private LogMovementRepository logMovementRepository;
    private LogChoicesExecutedRepository logChoicesRepository;
    private GamingStoryProgressRepository storyProgressRepository;
    private MatchPersistenceAdapter adapter;
    private MatchReadAdapter readAdapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        locationsRepository = mock(GamingStateLocationsRepository.class);
        registryRepository = mock(GamingStateRegistryRepository.class);
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        backpackRepository = mock(GamingBackpackResourcesRepository.class);
        characterTraitsRepository = mock(GamingCharacterTraitsRepository.class);
        inventoryRepository = mock(GamingInventoryItemsRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        logMovementRepository = mock(LogMovementRepository.class);
        logChoicesRepository = mock(LogChoicesExecutedRepository.class);
        storyProgressRepository = mock(GamingStoryProgressRepository.class);
        adapter = new MatchPersistenceAdapter(matchRepository, locationsRepository, registryRepository,
                characterRepository, backpackRepository, characterTraitsRepository, inventoryRepository,
                logEventsRepository, logMovementRepository, logChoicesRepository, storyProgressRepository);
        readAdapter = new MatchReadAdapter(matchRepository, locationsRepository, registryRepository);
    }

    @Test
    void saveMatch_delegatesToRepository() {
        GamingMatchEntity entity = new GamingMatchEntity();
        when(matchRepository.save(entity)).thenReturn(entity);
        assertSame(entity, adapter.saveMatch(entity));
        verify(matchRepository).save(entity);
    }

    @Test
    void findMatchByUuid_delegates() {
        when(matchRepository.findByUuid("u")).thenReturn(Optional.of(new GamingMatchEntity()));
        assertTrue(adapter.findMatchByUuid("u").isPresent());
        verify(matchRepository).findByUuid("u");
    }

    @Test
    void hasActiveMatchForStory_delegatesToRepository() {
        when(matchRepository.existsByIdUserCreatorAndIdStoryAndStatusIn(7L, 2L, List.of("CREATED")))
                .thenReturn(true);
        assertTrue(adapter.hasActiveMatchForStory(7L, 2L, List.of("CREATED")));
        verify(matchRepository).existsByIdUserCreatorAndIdStoryAndStatusIn(7L, 2L, List.of("CREATED"));
    }

    @Test
    void hasActiveMatchForStory_falseOnMissingArguments() {
        assertFalse(adapter.hasActiveMatchForStory(null, 2L, List.of("CREATED")));
        assertFalse(adapter.hasActiveMatchForStory(7L, null, List.of("CREATED")));
        assertFalse(adapter.hasActiveMatchForStory(7L, 2L, null));
        assertFalse(adapter.hasActiveMatchForStory(7L, 2L, List.of()));
        verify(matchRepository, never()).existsByIdUserCreatorAndIdStoryAndStatusIn(any(), any(), any());
    }

    @Test
    void saveLocations_skipsWhenNullOrEmpty() {
        adapter.saveLocations(null);
        adapter.saveLocations(List.of());
        verify(locationsRepository, never()).saveAll(any());
    }

    @Test
    void saveLocations_savesAll() {
        List<GamingStateLocationsEntity> list = List.of(new GamingStateLocationsEntity());
        adapter.saveLocations(list);
        verify(locationsRepository).saveAll(list);
    }

    @Test
    void saveRegistry_skipsWhenNullOrEmpty() {
        adapter.saveRegistry(null);
        adapter.saveRegistry(List.of());
        verify(registryRepository, never()).saveAll(any());
    }

    @Test
    void saveRegistry_savesAll() {
        List<GamingStateRegistryEntity> list = List.of(new GamingStateRegistryEntity());
        adapter.saveRegistry(list);
        verify(registryRepository).saveAll(list);
    }

    @Test
    void deleteMatchesByNameLike_noMatches_returnsZeroAndSkipsChildren() {
        when(matchRepository.findMatchIdsByNameLike("robottest%")).thenReturn(List.of());

        int deleted = adapter.deleteMatchesByNameLike("robottest%");

        assertEquals(0, deleted);
        verify(locationsRepository, never()).deleteByMatchIdIn(any());
        verify(registryRepository, never()).deleteByMatchIdIn(any());
        verify(characterRepository, never()).deleteByMatchIdIn(any());
        verify(matchRepository, never()).deleteByNameLike(any());
    }

    @Test
    void deleteMatchesByNameLike_deletesChildrenThenMatches() {
        List<Long> ids = List.of(1L, 2L);
        when(matchRepository.findMatchIdsByNameLike("robottest%")).thenReturn(ids);
        when(matchRepository.deleteByNameLike("robottest%")).thenReturn(2);

        int deleted = adapter.deleteMatchesByNameLike("robottest%");

        assertEquals(2, deleted);
        // current-turn FK must be cleared before the character rows are deleted
        verify(matchRepository).clearCurrentTurnByMatchIdIn(ids);
        verify(characterTraitsRepository).deleteByMatchIdIn(ids);
        verify(inventoryRepository).deleteByMatchIdIn(ids);
        verify(backpackRepository).deleteByMatchIdIn(ids);
        verify(logEventsRepository).deleteByMatchIdIn(ids);
        // log_movements references gaming_character_instance (FK enforced on PostgreSQL)
        verify(logMovementRepository).deleteByMatchIdIn(ids);
        // Step 32 — SQLite ignores the schema's ON DELETE CASCADE, so these go explicitly
        verify(logChoicesRepository).deleteByMatchIdIn(ids);
        verify(storyProgressRepository).deleteByMatchIdIn(ids);
        verify(characterRepository).deleteByMatchIdIn(ids);
        verify(locationsRepository).deleteByMatchIdIn(ids);
        verify(registryRepository).deleteByMatchIdIn(ids);
        verify(matchRepository).deleteByNameLike("robottest%");
    }

    @Test
    void updateMatchFields_updatesStatusAndName() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setStatus("CREATED");
        m.setName("old");
        when(matchRepository.findByUuid("u")).thenReturn(Optional.of(m));

        assertTrue(adapter.updateMatchFields("u", "ENDED", "new"));

        assertEquals("ENDED", m.getStatus());
        assertEquals("new", m.getName());
        verify(matchRepository).save(m);
    }

    @Test
    void updateMatchFields_nullFieldsLeaveValuesUnchanged() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setStatus("RUNNING");
        m.setName("keep");
        when(matchRepository.findByUuid("u")).thenReturn(Optional.of(m));

        adapter.updateMatchFields("u", null, null);

        assertEquals("RUNNING", m.getStatus());
        assertEquals("keep", m.getName());
    }

    @Test
    void updateMatchFields_unknownUuid_returnsFalse() {
        when(matchRepository.findByUuid("u")).thenReturn(Optional.empty());
        assertFalse(adapter.updateMatchFields("u", "ENDED", null));
        verify(matchRepository, never()).save(any());
    }

    @Test
    void deleteMatchByUuid_deletesMatchAndChildren() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(5L);
        when(matchRepository.findByUuid("u")).thenReturn(Optional.of(m));

        assertTrue(adapter.deleteMatchByUuid("u"));

        verify(matchRepository).clearCurrentTurnByMatchIdIn(List.of(5L));
        verify(logEventsRepository).deleteByMatchIdIn(List.of(5L));
        verify(characterTraitsRepository).deleteByMatchIdIn(List.of(5L));
        verify(inventoryRepository).deleteByMatchIdIn(List.of(5L));
        verify(backpackRepository).deleteByMatchIdIn(List.of(5L));
        verify(logChoicesRepository).deleteByMatchIdIn(List.of(5L));
        verify(storyProgressRepository).deleteByMatchIdIn(List.of(5L));
        verify(characterRepository).deleteByMatchIdIn(List.of(5L));
        verify(locationsRepository).deleteByMatchIdIn(List.of(5L));
        verify(registryRepository).deleteByMatchIdIn(List.of(5L));
        verify(matchRepository).delete(m);
    }

    @Test
    void deleteMatchByUuid_unknownUuid_returnsFalse() {
        when(matchRepository.findByUuid("u")).thenReturn(Optional.empty());
        assertFalse(adapter.deleteMatchByUuid("u"));
        verify(matchRepository, never()).delete(any());
    }

    @Test
    void readAdapter_findMatchByUuid() {
        when(matchRepository.findByUuid("u")).thenReturn(Optional.of(new GamingMatchEntity()));
        assertTrue(readAdapter.findMatchByUuid("u").isPresent());
    }

    @Test
    void readAdapter_findMatchesByUserId_nullReturnsEmpty() {
        assertTrue(readAdapter.findMatchesByUserId(null).isEmpty());
        verify(matchRepository, never()).findByIdUserCreatorOrderByTsInsertDesc(any());
    }

    @Test
    void readAdapter_findMatchesByUserId_delegates() {
        when(matchRepository.findByIdUserCreatorOrderByTsInsertDesc(7L))
                .thenReturn(List.of(new GamingMatchEntity()));
        assertEquals(1, readAdapter.findMatchesByUserId(7L).size());
    }

    @Test
    void readAdapter_findAllMatches_delegates() {
        when(matchRepository.findAllByOrderByTsInsertDesc())
                .thenReturn(List.of(new GamingMatchEntity()));
        assertEquals(1, readAdapter.findAllMatches().size());
    }

    @Test
    void readAdapter_findLocationsByMatchId_nullReturnsEmpty() {
        assertTrue(readAdapter.findLocationsByMatchId(null).isEmpty());
    }

    @Test
    void readAdapter_findLocationsByMatchId_delegates() {
        when(locationsRepository.findByIdMatch(1L))
                .thenReturn(List.of(new GamingStateLocationsEntity()));
        assertEquals(1, readAdapter.findLocationsByMatchId(1L).size());
    }

    @Test
    void readAdapter_findRegistryByMatchId_nullReturnsEmpty() {
        assertTrue(readAdapter.findRegistryByMatchId(null).isEmpty());
    }

    @Test
    void readAdapter_findRegistryByMatchId_delegates() {
        when(registryRepository.findByIdMatch(1L))
                .thenReturn(List.of(new GamingStateRegistryEntity()));
        assertEquals(1, readAdapter.findRegistryByMatchId(1L).size());
    }

    @Test
    void readAdapter_findMatchesPage_delegatesWithLimitAndCriteria() {
        var criteria = new games.paths.core.port.match.MatchReadPort.MatchPageCriteria(
                "RUNNING", 7L, 2L, "2024-01-01T00:00:00Z", "2024-02-02T00:00:00Z", 9L, 25);
        when(matchRepository.findMatchesPage(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(new GamingMatchEntity()));

        assertEquals(1, readAdapter.findMatchesPage(criteria).size());

        var pageCaptor = org.mockito.ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(matchRepository).findMatchesPage(eq("RUNNING"), eq(7L), eq(2L),
                eq("2024-01-01T00:00:00Z"), eq("2024-02-02T00:00:00Z"), eq(9L), pageCaptor.capture());
        assertEquals(25, pageCaptor.getValue().getPageSize());
        assertEquals(0, pageCaptor.getValue().getPageNumber());
    }

    @Test
    void readAdapter_findMatchesPage_clampsNonPositiveLimit() {
        var criteria = new games.paths.core.port.match.MatchReadPort.MatchPageCriteria(
                null, null, null, null, null, null, 0);
        when(matchRepository.findMatchesPage(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of());

        readAdapter.findMatchesPage(criteria);

        var pageCaptor = org.mockito.ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(matchRepository).findMatchesPage(any(), any(), any(), any(), any(), any(), pageCaptor.capture());
        assertEquals(1, pageCaptor.getValue().getPageSize()); // PageRequest rejects size < 1
    }
}
