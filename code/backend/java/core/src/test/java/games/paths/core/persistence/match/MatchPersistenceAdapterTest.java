package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingCharacterTraitsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateLocationsRepository;
import games.paths.core.repository.match.GamingStateRegistryRepository;

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
        adapter = new MatchPersistenceAdapter(matchRepository, locationsRepository, registryRepository,
                characterRepository, backpackRepository, characterTraitsRepository);
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
        verify(characterTraitsRepository).deleteByMatchIdIn(ids);
        verify(backpackRepository).deleteByMatchIdIn(ids);
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

        verify(characterTraitsRepository).deleteByMatchIdIn(List.of(5L));
        verify(backpackRepository).deleteByMatchIdIn(List.of(5L));
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
}
