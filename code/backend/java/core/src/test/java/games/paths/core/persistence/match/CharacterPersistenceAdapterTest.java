package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingCharacterTraitsRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CharacterPersistenceAdapterTest {

    private GamingCharacterInstanceRepository characterRepository;
    private GamingBackpackResourcesRepository backpackRepository;
    private GamingCharacterTraitsRepository traitsRepository;
    private GamingInventoryItemsRepository inventoryRepository;
    private CharacterPersistenceAdapter adapter;
    private CharacterReadAdapter readAdapter;

    @BeforeEach
    void setUp() {
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        backpackRepository = mock(GamingBackpackResourcesRepository.class);
        traitsRepository = mock(GamingCharacterTraitsRepository.class);
        inventoryRepository = mock(GamingInventoryItemsRepository.class);
        adapter = new CharacterPersistenceAdapter(characterRepository, backpackRepository, traitsRepository);
        readAdapter = new CharacterReadAdapter(characterRepository, backpackRepository, traitsRepository, inventoryRepository);
    }

    // ─── write adapter ──────────────────────────────────────────────────────

    @Test
    void saveCharacter_delegates() {
        GamingCharacterInstanceEntity e = new GamingCharacterInstanceEntity();
        when(characterRepository.save(e)).thenReturn(e);
        assertSame(e, adapter.saveCharacter(e));
    }

    @Test
    void saveBackpack_nullSkips() {
        adapter.saveBackpack(null);
        verify(backpackRepository, never()).save(any());
    }

    @Test
    void saveBackpack_saves() {
        GamingBackpackResourcesEntity b = new GamingBackpackResourcesEntity();
        adapter.saveBackpack(b);
        verify(backpackRepository).save(b);
    }

    @Test
    void saveTraits_nullOrEmptySkips() {
        adapter.saveTraits(null);
        adapter.saveTraits(List.of());
        verify(traitsRepository, never()).saveAll(any());
    }

    @Test
    void saveTraits_savesAll() {
        List<GamingCharacterTraitsEntity> list = List.of(new GamingCharacterTraitsEntity());
        adapter.saveTraits(list);
        verify(traitsRepository).saveAll(list);
    }

    @Test
    void findCharacterByMatchIdAndUserId_nullArgs_empty() {
        assertTrue(adapter.findCharacterByMatchIdAndUserId(null, 1L).isEmpty());
        assertTrue(adapter.findCharacterByMatchIdAndUserId(1L, null).isEmpty());
        verify(characterRepository, never()).findByIdMatchAndIdUser(any(), any());
    }

    @Test
    void findCharacterByMatchIdAndUserId_delegates() {
        when(characterRepository.findByIdMatchAndIdUser(1L, 2L))
                .thenReturn(Optional.of(new GamingCharacterInstanceEntity()));
        assertTrue(adapter.findCharacterByMatchIdAndUserId(1L, 2L).isPresent());
    }

    @Test
    void countCharactersByMatchId_nullZero() {
        assertEquals(0, adapter.countCharactersByMatchId(null));
        verify(characterRepository, never()).countByIdMatch(any());
    }

    @Test
    void countCharactersByMatchId_delegates() {
        when(characterRepository.countByIdMatch(1L)).thenReturn(3L);
        assertEquals(3, adapter.countCharactersByMatchId(1L));
    }

    @Test
    void updateCharacterStats_entityPresent_updatesAndSaves() {
        GamingCharacterInstanceEntity entity = new GamingCharacterInstanceEntity();
        when(characterRepository.findByIdMatchAndId(1L, 2L)).thenReturn(Optional.of(entity));

        adapter.updateCharacterStats(1L, 2L, 10, 11, 12, 50, 100, 5);

        assertEquals(10, entity.getDexterity());
        assertEquals(11, entity.getIntelligence());
        assertEquals(12, entity.getConstitution());
        assertEquals(50, entity.getEnergy());
        assertEquals(100, entity.getLife());
        assertEquals(5, entity.getSad());
        verify(characterRepository).save(entity);
    }

    @Test
    void updateCharacterStats_entityAbsent_noSave() {
        when(characterRepository.findByIdMatchAndId(1L, 2L)).thenReturn(Optional.empty());

        adapter.updateCharacterStats(1L, 2L, 10, 11, 12, 50, 100, 5);

        verify(characterRepository, never()).save(any());
    }

    @Test
    void updateCharacterStats_nullFields_skipsNulls() {
        GamingCharacterInstanceEntity entity = new GamingCharacterInstanceEntity();
        entity.setDexterity(99);
        when(characterRepository.findByIdMatchAndId(1L, 2L)).thenReturn(Optional.of(entity));

        adapter.updateCharacterStats(1L, 2L, null, null, null, null, null, null);

        assertEquals(99, entity.getDexterity());
        verify(characterRepository).save(entity);
    }

    @Test
    void updateBackpackStats_entityPresent_updatesAndSaves() {
        GamingBackpackResourcesEntity entity = new GamingBackpackResourcesEntity();
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 2L)).thenReturn(Optional.of(entity));

        adapter.updateBackpackStats(1L, 2L, 5, 10, 20);

        assertEquals(5, entity.getFood());
        assertEquals(10, entity.getMagic());
        assertEquals(20, entity.getCoin());
        verify(backpackRepository).save(entity);
    }

    @Test
    void updateBackpackStats_entityAbsent_noSave() {
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 2L)).thenReturn(Optional.empty());

        adapter.updateBackpackStats(1L, 2L, 5, 10, 20);

        verify(backpackRepository, never()).save(any());
    }

    @Test
    void updateBackpackStats_nullFields_skipsNulls() {
        GamingBackpackResourcesEntity entity = new GamingBackpackResourcesEntity();
        entity.setFood(77);
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 2L)).thenReturn(Optional.of(entity));

        adapter.updateBackpackStats(1L, 2L, null, null, null);

        assertEquals(77, entity.getFood());
        verify(backpackRepository).save(entity);
    }

    // ─── read adapter ──────────────────────────────────────────────────────

    @Test
    void read_findCharactersByMatchId_nullEmpty() {
        assertTrue(readAdapter.findCharactersByMatchId(null).isEmpty());
    }

    @Test
    void read_findCharactersByMatchId_delegates() {
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(new GamingCharacterInstanceEntity()));
        assertEquals(1, readAdapter.findCharactersByMatchId(1L).size());
    }

    @Test
    void read_findCharacterByMatchIdAndUuid_nullOrBlankEmpty() {
        assertTrue(readAdapter.findCharacterByMatchIdAndUuid(null, "u").isEmpty());
        assertTrue(readAdapter.findCharacterByMatchIdAndUuid(1L, " ").isEmpty());
    }

    @Test
    void read_findCharacterByMatchIdAndUuid_delegates() {
        when(characterRepository.findByIdMatchAndUuid(1L, "u"))
                .thenReturn(Optional.of(new GamingCharacterInstanceEntity()));
        assertTrue(readAdapter.findCharacterByMatchIdAndUuid(1L, "u").isPresent());
    }

    @Test
    void read_findBackpack_nullEmpty() {
        assertTrue(readAdapter.findBackpack(null, 1L).isEmpty());
        assertTrue(readAdapter.findBackpack(1L, null).isEmpty());
    }

    @Test
    void read_findBackpack_delegates() {
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 2L))
                .thenReturn(Optional.of(new GamingBackpackResourcesEntity()));
        assertTrue(readAdapter.findBackpack(1L, 2L).isPresent());
    }

    @Test
    void read_findTraits_nullEmpty() {
        assertTrue(readAdapter.findTraits(null, 1L).isEmpty());
        assertTrue(readAdapter.findTraits(1L, null).isEmpty());
    }

    @Test
    void read_findTraits_delegates() {
        when(traitsRepository.findByIdMatchAndIdCharacterMatch(1L, 2L))
                .thenReturn(List.of(new GamingCharacterTraitsEntity()));
        assertEquals(1, readAdapter.findTraits(1L, 2L).size());
    }

    @Test
    void read_findInventory_nullEmpty() {
        assertTrue(readAdapter.findInventory(null, 1L).isEmpty());
        assertTrue(readAdapter.findInventory(1L, null).isEmpty());
    }

    @Test
    void read_findInventory_delegates() {
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 2L))
                .thenReturn(List.of(new GamingInventoryItemsEntity()));
        assertEquals(1, readAdapter.findInventory(1L, 2L).size());
    }
}
