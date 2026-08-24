package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntityId;
import games.paths.core.entity.story.ItemEffectEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.ResourceDelta;
import games.paths.core.port.match.InventoryStorePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.LogItemUsageRepository;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * InventoryStoreAdapter - JPA adapter implementing {@link InventoryStorePort}. Step 34.
 */
@Repository
@Transactional
public class InventoryStoreAdapter implements InventoryStorePort {

    private final GamingMatchRepository matchRepository;
    private final GamingCharacterInstanceRepository characterRepository;
    private final GamingInventoryItemsRepository inventoryRepository;
    private final GamingBackpackResourcesRepository backpackRepository;
    private final LogItemUsageRepository logItemUsageRepository;
    private final StoryReadPort storyReadPort;

    public InventoryStoreAdapter(GamingMatchRepository matchRepository,
                                 GamingCharacterInstanceRepository characterRepository,
                                 GamingInventoryItemsRepository inventoryRepository,
                                 GamingBackpackResourcesRepository backpackRepository,
                                 LogItemUsageRepository logItemUsageRepository,
                                 StoryReadPort storyReadPort) {
        this.matchRepository = matchRepository;
        this.characterRepository = characterRepository;
        this.inventoryRepository = inventoryRepository;
        this.backpackRepository = backpackRepository;
        this.logItemUsageRepository = logItemUsageRepository;
        this.storyReadPort = storyReadPort;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MatchInventoryView> findMatchByUuid(String matchUuid) {
        return matchRepository.findByUuid(matchUuid)
                .map(m -> new MatchInventoryView(m.getId(), m.getUuid(), m.getStatus(), m.getIdStory()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<InventoryCharacterView> findCharacterByMatchAndUser(long idMatch, long idUser) {
        return characterRepository.findByIdMatchAndIdUser(idMatch, idUser)
                .map(c -> new InventoryCharacterView(
                        c.getId(), c.getUuid(), c.getIdClass(),
                        Boolean.TRUE.equals(c.getIsSleeping()),
                        Boolean.TRUE.equals(c.getIsComa()),
                        c.getWeightMax() != null ? c.getWeightMax() : 0));
    }

    @Override
    @Transactional(readOnly = true)
    public List<GamingInventoryItemsEntity> findInventory(long idMatch, long idCharacter) {
        List<GamingInventoryItemsEntity> rows =
                new ArrayList<>(inventoryRepository.findByIdMatchAndIdCharacterMatch(idMatch, idCharacter));
        rows.sort(Comparator.comparing(GamingInventoryItemsEntity::getId,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return rows;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, ItemEntity> findItemsById(long idStory) {
        Map<Long, ItemEntity> byId = new HashMap<>();
        for (ItemEntity i : storyReadPort.findItemsByStoryId(idStory)) {
            byId.put(i.getId(), i);
        }
        return byId;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, List<ItemEffectEntity>> findItemEffectsByItemId(long idStory) {
        // One query for the whole story, grouped in memory: an item has a handful of
        // effect rows, and a per-item query would be an N+1 on the listing path.
        List<ItemEffectEntity> all = new ArrayList<>(storyReadPort.findItemEffectsByStoryId(idStory));
        all.sort(Comparator.comparing(ItemEffectEntity::getId,
                Comparator.nullsLast(Comparator.naturalOrder())));
        Map<Long, List<ItemEffectEntity>> byItem = new LinkedHashMap<>();
        for (ItemEffectEntity e : all) {
            if (e.getIdItem() == null) {
                continue;
            }
            byItem.computeIfAbsent(e.getIdItem().longValue(), k -> new ArrayList<>()).add(e);
        }
        return byItem;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<EventExecutionStorePort.BackpackStats> findBackpack(long idMatch, long idCharacter) {
        return backpackRepository.findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)
                .map(b -> new EventExecutionStorePort.BackpackStats(
                        nz(b.getFood()), nz(b.getMagic()), nz(b.getCoin())));
    }

    private static int nz(Integer v) {
        return v != null ? v : 0;
    }

    @Override
    public void deleteInventoryRow(long idMatch, long idRow) {
        inventoryRepository.deleteById(new GamingInventoryItemsEntityId(idRow, idMatch));
    }

    @Override
    public void logItemAction(long idMatch, long idCharacter, long idItem, String action,
                              int counter, String effectsJson, ResourceDelta delta) {
        // v0.35.1 — counter is the units this action actually moved. It was hardcoded to 1
        // while a usage spent the whole row, so the column has been reporting a number
        // nobody computed since the log was created.
        // idEvent stays null: a use and a drop are the player's own doing, not an event's.
        ItemLogRows.append(logItemUsageRepository, idMatch, idCharacter, idItem, action,
                counter, null, effectsJson, delta);
    }

    @Override
    @Transactional
    public void updateInventoryAmount(long idMatch, long idRow, int amount) {
        inventoryRepository.findById(new GamingInventoryItemsEntityId(idRow, idMatch))
                .ifPresent(row -> {
                    row.setAmount(amount);
                    inventoryRepository.save(row);
                });
    }
}
