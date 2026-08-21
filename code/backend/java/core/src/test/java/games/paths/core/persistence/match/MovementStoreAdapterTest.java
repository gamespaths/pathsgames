package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.LogMovementEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.LocationNeighborEntity;
import games.paths.core.port.match.MovementStorePort.MatchMovementView;
import games.paths.core.port.match.MovementStorePort.MoveCharacterView;
import games.paths.core.port.match.MovementStorePort.MoveLocationView;
import games.paths.core.port.match.MovementStorePort.NeighborEdge;
import games.paths.core.port.match.MovementStorePort.WeatherMoveCost;
import games.paths.core.port.match.WeatherStorePort;
import games.paths.core.port.match.WeatherStorePort.CurrentWeatherView;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MovementStoreAdapterTest {

    private GamingMatchRepository matchRepository;
    private GamingCharacterInstanceRepository characterRepository;
    private LogMovementRepository logMovementRepository;
    private GamingInventoryItemsRepository inventoryRepository;
    private StoryReadPort storyReadPort;
    private WeatherStorePort weatherStorePort;
    private MovementStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        logMovementRepository = mock(LogMovementRepository.class);
        inventoryRepository = mock(GamingInventoryItemsRepository.class);
        storyReadPort = mock(StoryReadPort.class);
        weatherStorePort = mock(WeatherStorePort.class);
        adapter = new MovementStoreAdapter(matchRepository, characterRepository,
                logMovementRepository, inventoryRepository, storyReadPort, weatherStorePort);
    }

    private static GamingMatchEntity match() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(1L);
        m.setUuid("m");
        m.setStatus("RUNNING");
        m.setCurrentClock(3);
        m.setIdStory(9001L);
        m.setIdUserCreator(100L);
        return m;
    }

    private static GamingCharacterInstanceEntity character(long id, Long location) {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(id);
        c.setIdMatch(1L);
        c.setUuid("c" + id);
        c.setIdUser(100L);
        c.setIdLocation(location);
        c.setEnergy(40);
        c.setEnergyMax(100);
        c.setWeightMax(30);
        c.setIsSleeping(false);
        c.setIsComa(false);
        return c;
    }

    private static LocationEntity location(long id, int secure, int enter, int max) {
        LocationEntity l = new LocationEntity();
        l.setId(id);
        l.setUuid("loc-" + id);
        l.setIdCard(7);
        l.setSecureParam(secure);
        l.setCostEnergyEnter(enter);
        l.setMaxCharacters(max);
        return l;
    }

    @Test
    void findMatchByUuid_maps() {
        when(matchRepository.findByUuid("m")).thenReturn(Optional.of(match()));
        MatchMovementView v = adapter.findMatchByUuid("m").orElseThrow();
        assertEquals(1L, v.id());
        assertEquals(9001L, v.idStory());
        assertEquals(100L, v.idUserCreator());
        assertEquals(3, v.currentClock());
    }

    /** Step 35 — an empty inventory still weighs nothing, but now because it is empty. */
    @Test
    void findCharacter_zeroCarriedWeightWhenInventoryEmpty() {
        when(matchRepository.findById(1L)).thenReturn(Optional.of(match()));
        when(characterRepository.findByIdMatchAndIdUser(1L, 100L))
                .thenReturn(Optional.of(character(50L, 2L)));
        MoveCharacterView v = adapter.findCharacterByMatchAndUser(1L, 100L).orElseThrow();
        assertEquals(50L, v.id());
        assertEquals(2L, v.idLocation());
        assertEquals(0, v.carriedWeight());
        assertEquals(30, v.weightMax());
    }

    /** Step 35 — Sigma (item.weight x amount), the same formula the /info endpoint reports. */
    @Test
    void findCharacter_mapsRealCarriedWeight() {
        when(matchRepository.findById(1L)).thenReturn(Optional.of(match()));
        when(storyReadPort.findItemsByStoryId(9001L))
                .thenReturn(List.of(storyItem(900L, 3), storyItem(901L, 5)));
        when(inventoryRepository.findByIdMatch(1L)).thenReturn(List.of(
                inventoryRow(50L, 900L, 2),   // 3 x 2 = 6
                inventoryRow(50L, 901L, 1),   // 5 x 1 = 5
                inventoryRow(51L, 901L, 4))); // another character, must not leak in
        when(characterRepository.findByIdMatchAndIdUser(1L, 100L))
                .thenReturn(Optional.of(character(50L, 2L)));

        MoveCharacterView v = adapter.findCharacterByMatchAndUser(1L, 100L).orElseThrow();

        assertEquals(11, v.carriedWeight());
    }

    /** A null amount counts as one and an item the story does not define weighs nothing. */
    @Test
    void findCharacter_carriedWeightNullAmountAndUnknownItem() {
        when(matchRepository.findById(1L)).thenReturn(Optional.of(match()));
        when(storyReadPort.findItemsByStoryId(9001L)).thenReturn(List.of(storyItem(900L, 7)));
        when(inventoryRepository.findByIdMatch(1L)).thenReturn(List.of(
                inventoryRow(50L, 900L, null),  // 7 x 1
                inventoryRow(50L, 999L, 3)));   // unknown item -> 0
        when(characterRepository.findByIdMatchAndIdUser(1L, 100L))
                .thenReturn(Optional.of(character(50L, 2L)));

        assertEquals(7, adapter.findCharacterByMatchAndUser(1L, 100L).orElseThrow().carriedWeight());
    }

    /** Three queries for the whole match, however many characters it holds: no N+1. */
    @Test
    void findCharactersByMatchId_readsInventoryOnceForEveryCharacter() {
        when(matchRepository.findById(1L)).thenReturn(Optional.of(match()));
        when(storyReadPort.findItemsByStoryId(9001L)).thenReturn(List.of(storyItem(900L, 2)));
        when(inventoryRepository.findByIdMatch(1L)).thenReturn(List.of(
                inventoryRow(50L, 900L, 1),
                inventoryRow(51L, 900L, 3)));
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(
                character(50L, 2L), character(51L, 2L), character(52L, 2L)));

        List<MoveCharacterView> views = adapter.findCharactersByMatchId(1L);

        assertEquals(2, views.get(0).carriedWeight());
        assertEquals(6, views.get(1).carriedWeight());
        assertEquals(0, views.get(2).carriedWeight());
        verify(inventoryRepository, times(1)).findByIdMatch(1L);
    }

    /** No story on the match: nothing can be weighed, and no inventory query is made. */
    @Test
    void findCharacter_carriedWeightZeroWhenMatchHasNoStory() {
        GamingMatchEntity storyless = match();
        storyless.setIdStory(null);
        when(matchRepository.findById(1L)).thenReturn(Optional.of(storyless));
        when(characterRepository.findByIdMatchAndIdUser(1L, 100L))
                .thenReturn(Optional.of(character(50L, 2L)));

        assertEquals(0, adapter.findCharacterByMatchAndUser(1L, 100L).orElseThrow().carriedWeight());
        verify(inventoryRepository, never()).findByIdMatch(anyLong());
    }

    private static ItemEntity storyItem(long id, int weight) {
        ItemEntity i = new ItemEntity();
        i.setId(id);
        i.setWeight(weight);
        return i;
    }

    private static GamingInventoryItemsEntity inventoryRow(long idCharacter, long idItem, Integer amount) {
        GamingInventoryItemsEntity r = new GamingInventoryItemsEntity();
        r.setIdCharacterMatch(idCharacter);
        r.setIdItem(idItem);
        r.setAmount(amount);
        return r;
    }

    @Test
    void findLocationByStoryAndUuid_maps() {
        when(storyReadPort.findLocationByStoryIdAndUuid(9001L, "loc-2"))
                .thenReturn(Optional.of(location(2L, 1, 1, 50)));
        MoveLocationView v = adapter.findLocationByStoryAndUuid(9001L, "loc-2").orElseThrow();
        assertEquals(2L, v.id());
        assertEquals(1, v.secureParam());
        assertEquals(50, v.maxCharacters());
    }

    @Test
    void findLocationByStoryAndId_filters() {
        when(storyReadPort.findLocationsByStoryId(9001L))
                .thenReturn(List.of(location(1L, 0, 0, 0), location(2L, 1, 1, 50)));
        assertEquals("loc-2", adapter.findLocationByStoryAndId(9001L, 2L).orElseThrow().uuid());
        assertTrue(adapter.findLocationByStoryAndId(9001L, 99L).isEmpty());
    }

    @Test
    void findNeighbors_filtersByEitherEndpoint() {
        LocationNeighborEntity n1 = new LocationNeighborEntity();
        n1.setIdLocationFrom(1); n1.setIdLocationTo(2); n1.setDirection("N"); n1.setEnergyCost(3);
        LocationNeighborEntity n2 = new LocationNeighborEntity();
        n2.setIdLocationFrom(3); n2.setIdLocationTo(1); n2.setDirection("S"); n2.setEnergyCost(1);
        LocationNeighborEntity nOther = new LocationNeighborEntity();
        nOther.setIdLocationFrom(4); nOther.setIdLocationTo(5); nOther.setDirection("E"); nOther.setEnergyCost(2);
        when(storyReadPort.findLocationNeighborsByStoryId(9001L)).thenReturn(List.of(n1, n2, nOther));

        List<NeighborEdge> edges = adapter.findNeighborsOfLocation(9001L, 1L);
        assertEquals(2, edges.size());
    }

    @Test
    void weatherMoveCost_fromCurrentWeather_orZero() {
        when(weatherStorePort.findCurrentWeather(1L)).thenReturn(Optional.of(
                new CurrentWeatherView(5L, "w", 9001L, 1, 1, 0, 2, 7, 3)));
        WeatherMoveCost c = adapter.findCurrentWeatherMoveCost(1L);
        assertEquals(2, c.costSafe());
        assertEquals(7, c.costNotSafe());

        when(weatherStorePort.findCurrentWeather(2L)).thenReturn(Optional.empty());
        WeatherMoveCost z = adapter.findCurrentWeatherMoveCost(2L);
        assertEquals(0, z.costSafe());
        assertEquals(0, z.costNotSafe());
    }

    @Test
    void countCharactersAtLocation() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(
                character(50L, 2L), character(51L, 2L), character(52L, 3L)));
        assertEquals(2, adapter.countCharactersAtLocation(1L, 2L));
    }

    @Test
    void updateCharacterLocationAndEnergy_persists() {
        GamingCharacterInstanceEntity c = character(50L, 1L);
        when(characterRepository.findById(any())).thenReturn(Optional.of(c));
        adapter.updateCharacterLocationAndEnergy(1L, 50L, 2L, 18);
        assertEquals(2L, c.getIdLocation());
        assertEquals(18, c.getEnergy());
        verify(characterRepository).save(c);
    }

    @Test
    void insertMovementLog_assignsNextId() {
        when(logMovementRepository.findMaxId()).thenReturn(4L);
        ArgumentCaptor<LogMovementEntity> cap = ArgumentCaptor.forClass(LogMovementEntity.class);
        adapter.insertMovementLog(1L, 50L, 1L, 2L, 6);
        verify(logMovementRepository).save(cap.capture());
        LogMovementEntity e = cap.getValue();
        assertEquals(5L, e.getId());
        assertEquals(1L, e.getIdLocationFrom());
        assertEquals(2L, e.getIdLocationTo());
        assertEquals(6, e.getEnergy());
    }

    @Test
    void findVisitedLocationIds_unionsPositionsAndLog() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(character(50L, 1L)));
        LogMovementEntity l = new LogMovementEntity();
        l.setIdLocationFrom(1L); l.setIdLocationTo(2L);
        when(logMovementRepository.findByIdMatch(1L)).thenReturn(List.of(l));
        List<Long> ids = adapter.findVisitedLocationIds(1L);
        assertTrue(ids.contains(1L));
        assertTrue(ids.contains(2L));
        assertEquals(2, ids.size());
    }

    @Test
    void findRegistryValue_delegates() {
        when(weatherStorePort.findRegistryValue(1L, "DOOR")).thenReturn(Optional.of("OPEN"));
        assertEquals("OPEN", adapter.findRegistryValue(1L, "DOOR").orElseThrow());
    }
}
