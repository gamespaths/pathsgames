package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntityId;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.LogItemUsageEntity;
import games.paths.core.entity.story.ItemEffectEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.InventoryStorePort.InventoryCharacterView;
import games.paths.core.port.match.InventoryStorePort.MatchInventoryView;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogItemUsageRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Unit tests for {@link InventoryStoreAdapter} (Step 34). */
@DisplayName("InventoryStoreAdapter (Step 34)")
class InventoryStoreAdapterTest {

    private static final long MATCH_ID = 1L;
    private static final long CHAR_ID = 50L;
    private static final long STORY_ID = 9001L;

    private GamingMatchRepository matchRepository;
    private GamingCharacterInstanceRepository characterRepository;
    private GamingInventoryItemsRepository inventoryRepository;
    private GamingBackpackResourcesRepository backpackRepository;
    private LogItemUsageRepository logItemUsageRepository;
    private StoryReadPort storyReadPort;
    private InventoryStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        inventoryRepository = mock(GamingInventoryItemsRepository.class);
        backpackRepository = mock(GamingBackpackResourcesRepository.class);
        logItemUsageRepository = mock(LogItemUsageRepository.class);
        storyReadPort = mock(StoryReadPort.class);
        adapter = new InventoryStoreAdapter(matchRepository, characterRepository, inventoryRepository,
                backpackRepository, logItemUsageRepository, storyReadPort);
    }

    private static GamingInventoryItemsEntity row(long id, long idItem) {
        GamingInventoryItemsEntity r = new GamingInventoryItemsEntity();
        r.setId(id);
        r.setIdMatch(MATCH_ID);
        r.setIdCharacterMatch(CHAR_ID);
        r.setIdItem(idItem);
        return r;
    }

    private static ItemEffectEntity effect(long id, int idItem) {
        ItemEffectEntity e = new ItemEffectEntity();
        e.setId(id);
        e.setIdItem(idItem);
        e.setEffectCode("LIFE");
        return e;
    }

    @Test
    void findMatchByUuid_maps() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(MATCH_ID);
        m.setUuid("m");
        m.setStatus("RUNNING");
        m.setIdStory(STORY_ID);
        when(matchRepository.findByUuid("m")).thenReturn(Optional.of(m));

        MatchInventoryView v = adapter.findMatchByUuid("m").orElseThrow();

        assertEquals(MATCH_ID, v.id());
        assertEquals("RUNNING", v.status());
        assertEquals(STORY_ID, v.idStory());
    }

    @Test
    @DisplayName("a null weight_max reads as 0, never as a null unboxing")
    void findCharacter_maps() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(CHAR_ID);
        c.setUuid("char");
        c.setIdClass(7L);
        c.setIsSleeping(Boolean.TRUE);
        when(characterRepository.findByIdMatchAndIdUser(MATCH_ID, 100L)).thenReturn(Optional.of(c));

        InventoryCharacterView v = adapter.findCharacterByMatchAndUser(MATCH_ID, 100L).orElseThrow();

        assertEquals(CHAR_ID, v.id());
        assertEquals(7L, v.idClass());
        assertTrue(v.isSleeping());
        assertFalse(v.isComa());
        assertEquals(0, v.weightMax());
    }

    @Test
    @DisplayName("a set weight_max is reported as it is")
    void findCharacter_reportsWeightMax() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(CHAR_ID);
        c.setUuid("char");
        c.setWeightMax(42);
        c.setIsComa(Boolean.TRUE);
        when(characterRepository.findByIdMatchAndIdUser(MATCH_ID, 100L)).thenReturn(Optional.of(c));

        InventoryCharacterView v = adapter.findCharacterByMatchAndUser(MATCH_ID, 100L).orElseThrow();

        assertEquals(42, v.weightMax());
        assertTrue(v.isComa());
        assertNull(v.idClass());
    }

    @Test
    @DisplayName("inventory rows come back in id order, a null id sorting last")
    void findInventory_ordersById() {
        GamingInventoryItemsEntity noId = row(0L, 900L);
        noId.setId(null);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(MATCH_ID, CHAR_ID))
                .thenReturn(List.of(row(3L, 900L), noId, row(1L, 901L)));

        List<GamingInventoryItemsEntity> rows = adapter.findInventory(MATCH_ID, CHAR_ID);

        assertEquals(1L, rows.get(0).getId());
        assertEquals(3L, rows.get(1).getId());
        assertNull(rows.get(2).getId());
    }

    @Test
    void findItemsById_keysByStoryItemId() {
        ItemEntity i = new ItemEntity();
        i.setId(900L);
        when(storyReadPort.findItemsByStoryId(STORY_ID)).thenReturn(List.of(i));

        assertSame(i, adapter.findItemsById(STORY_ID).get(900L));
    }

    @Test
    @DisplayName("effects are grouped per item with ONE query, ordered by id")
    void findItemEffectsByItemId_groupsInOneQuery() {
        when(storyReadPort.findItemEffectsByStoryId(STORY_ID)).thenReturn(List.of(
                effect(2L, 900), effect(1L, 900), effect(3L, 901)));

        Map<Long, List<ItemEffectEntity>> byItem = adapter.findItemEffectsByItemId(STORY_ID);

        assertEquals(2, byItem.get(900L).size());
        assertEquals(1L, byItem.get(900L).get(0).getId());
        assertEquals(2L, byItem.get(900L).get(1).getId());
        assertEquals(1, byItem.get(901L).size());
        verify(storyReadPort, times(1)).findItemEffectsByStoryId(STORY_ID);
    }

    @Test
    @DisplayName("an effect row with no id_item is skipped rather than grouped under null")
    void findItemEffectsByItemId_skipsOrphans() {
        ItemEffectEntity orphan = effect(1L, 0);
        orphan.setIdItem(null);
        when(storyReadPort.findItemEffectsByStoryId(STORY_ID)).thenReturn(List.of(orphan));

        assertTrue(adapter.findItemEffectsByItemId(STORY_ID).isEmpty());
    }

    @Test
    void deleteInventoryRow_usesTheCompositeKey() {
        adapter.deleteInventoryRow(MATCH_ID, 7L);

        ArgumentCaptor<GamingInventoryItemsEntityId> id =
                ArgumentCaptor.forClass(GamingInventoryItemsEntityId.class);
        verify(inventoryRepository).deleteById(id.capture());
        assertEquals(7L, id.getValue().getId());
        assertEquals(MATCH_ID, id.getValue().getIdMatch());
    }

    @Test
    void findBackpack_maps() {
        GamingBackpackResourcesEntity b = new GamingBackpackResourcesEntity();
        b.setFood(4);
        b.setMagic(2);
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(MATCH_ID, CHAR_ID))
                .thenReturn(Optional.of(b));

        BackpackStats stats = adapter.findBackpack(MATCH_ID, CHAR_ID).orElseThrow();

        assertEquals(4, stats.food());
        assertEquals(2, stats.magic());
        assertEquals(0, stats.coin(), "a null column reads as 0");
    }

    @Test
    void findBackpack_absent() {
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(MATCH_ID, CHAR_ID))
                .thenReturn(Optional.empty());
        assertTrue(adapter.findBackpack(MATCH_ID, CHAR_ID).isEmpty());
    }

    @Test
    @DisplayName("the log id is the TABLE-WIDE max plus one: log_item_usage carries UNIQUE (id)")
    void logItemUsage_allocatesAGloballyUniqueId() {
        when(logItemUsageRepository.findMaxId()).thenReturn(41L);

        adapter.logItemUsage(MATCH_ID, CHAR_ID, 900L, 2, "{}");

        ArgumentCaptor<LogItemUsageEntity> saved = ArgumentCaptor.forClass(LogItemUsageEntity.class);
        verify(logItemUsageRepository).save(saved.capture());
        LogItemUsageEntity row = saved.getValue();
        assertEquals(42L, row.getId());
        assertEquals(MATCH_ID, row.getIdMatch());
        assertEquals(CHAR_ID, row.getIdCharacterMatch());
        assertEquals(900L, row.getIdItem());
        // v0.35.1 — the units the usage actually spent, not the hardcoded 1 it used to be.
        assertEquals(2, row.getCounter());
        assertEquals("{}", row.getEffectsJson());
    }

    @Test
    @DisplayName("the first row of an empty table gets id 1")
    void logItemUsage_firstRow() {
        when(logItemUsageRepository.findMaxId()).thenReturn(0L);

        adapter.logItemUsage(MATCH_ID, CHAR_ID, 900L, 1, "{}");

        ArgumentCaptor<LogItemUsageEntity> saved = ArgumentCaptor.forClass(LogItemUsageEntity.class);
        verify(logItemUsageRepository).save(saved.capture());
        assertEquals(1L, saved.getValue().getId());
    }

    @Test
    @DisplayName("v0.35.1 — a partly spent row keeps what survived the usage")
    void updateInventoryAmount_writesTheSurvivingUnits() {
        GamingInventoryItemsEntity row = new GamingInventoryItemsEntity();
        row.setId(7L);
        row.setAmount(5);
        when(inventoryRepository.findById(any())).thenReturn(Optional.of(row));

        adapter.updateInventoryAmount(MATCH_ID, 7L, 3);

        assertEquals(3, row.getAmount());
        verify(inventoryRepository).save(row);
    }

    @Test
    @DisplayName("a row that is no longer there is not written back into existence")
    void updateInventoryAmount_missingRowIsANoOp() {
        when(inventoryRepository.findById(any())).thenReturn(Optional.empty());

        adapter.updateInventoryAmount(MATCH_ID, 7L, 3);

        verify(inventoryRepository, never()).save(any());
    }
}
