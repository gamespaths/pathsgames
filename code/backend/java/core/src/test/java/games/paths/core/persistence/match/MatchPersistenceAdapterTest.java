package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateLocationsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
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
    private MatchPersistenceAdapter adapter;
    private MatchReadAdapter readAdapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        locationsRepository = mock(GamingStateLocationsRepository.class);
        registryRepository = mock(GamingStateRegistryRepository.class);
        adapter = new MatchPersistenceAdapter(matchRepository, locationsRepository, registryRepository);
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
