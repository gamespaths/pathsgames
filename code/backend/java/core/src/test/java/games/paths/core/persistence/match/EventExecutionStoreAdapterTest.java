package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.LogMovementEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.port.match.WeatherStorePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingCharacterTraitsRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateRegistryRepository;
import games.paths.core.repository.match.GamingStoryProgressRepository;
import games.paths.core.repository.match.LogChoicesExecutedRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogItemUsageRepository;
import games.paths.core.repository.match.LogMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * EventExecutionStoreAdapter — the v0.29.3 forced-movement writes: the location update,
 * the cost-0 movement log and the location id→uuid map the engine checks ids against.
 */
class EventExecutionStoreAdapterTest {

    private GamingCharacterInstanceRepository characterRepository;
    private LogMovementRepository logMovementRepository;
    private StoryReadPort storyReadPort;
    private EventExecutionStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        logMovementRepository = mock(LogMovementRepository.class);
        storyReadPort = mock(StoryReadPort.class);
        adapter = new EventExecutionStoreAdapter(
                mock(GamingMatchRepository.class),
                characterRepository,
                mock(GamingBackpackResourcesRepository.class),
                mock(GamingInventoryItemsRepository.class),
                mock(GamingCharacterTraitsRepository.class),
                mock(games.paths.core.port.match.RegistryStorePort.class),
                mock(LogEventsRepository.class),
                mock(LogItemUsageRepository.class),
                logMovementRepository,
                mock(LogChoicesExecutedRepository.class),
                mock(GamingStoryProgressRepository.class),
                storyReadPort,
                mock(WeatherStorePort.class));
    }

    @Test
    void updateCharacterLocation_writesTheNewLocation() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(3L);
        c.setIdMatch(1L);
        c.setIdLocation(100L);
        when(characterRepository.findById(any())).thenReturn(Optional.of(c));

        adapter.updateCharacterLocation(1L, 3L, 200L);

        assertEquals(200L, c.getIdLocation());
        verify(characterRepository).save(c);
    }

    @Test
    void updateCharacterLocation_missingCharacterIsANoOp() {
        when(characterRepository.findById(any())).thenReturn(Optional.empty());

        adapter.updateCharacterLocation(1L, 3L, 200L);

        verify(characterRepository, never()).save(any());
    }

    @Test
    void insertMovementLog_writesTheRowWithTheNextId() {
        when(logMovementRepository.findMaxId()).thenReturn(41L);

        adapter.insertMovementLog(1L, 3L, 100L, 200L, 0, 0, 0, 0);

        ArgumentCaptor<LogMovementEntity> cap = ArgumentCaptor.forClass(LogMovementEntity.class);
        verify(logMovementRepository).save(cap.capture());
        LogMovementEntity row = cap.getValue();
        assertEquals(42L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals(3L, row.getIdCharacterMatch());
        assertEquals(100L, row.getIdLocationFrom());
        assertEquals(200L, row.getIdLocationTo());
        assertEquals(0, row.getEnergy());
    }

    @Test
    void findLocationUuidsById_mapsIdsAndSkipsNullOnes() {
        LocationEntity a = new LocationEntity();
        a.setId(90001L);
        a.setUuid("loc-a");
        LocationEntity broken = new LocationEntity();
        broken.setUuid("loc-without-id");
        when(storyReadPort.findLocationsByStoryId(9001L)).thenReturn(List.of(a, broken));

        Map<Long, String> out = adapter.findLocationUuidsById(9001L);

        assertEquals(Map.of(90001L, "loc-a"), out);
    }
}
