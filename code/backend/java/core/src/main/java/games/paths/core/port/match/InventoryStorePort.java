package games.paths.core.port.match;

import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.story.ItemEffectEntity;
import games.paths.core.entity.story.ItemEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * InventoryStorePort - Outbound port of the Step 34 inventory service.
 *
 * <p>Reads the inventory rows of one character, the story items and their
 * effects, deletes a row, and appends the usage log. Everything else the item
 * engine needs — the backpack, the stats, the traits — already belongs to
 * {@link EventExecutionStorePort} and is reused from there rather than
 * duplicated here.</p>
 */
public interface InventoryStorePort {

    Optional<MatchInventoryView> findMatchByUuid(String matchUuid);

    Optional<InventoryCharacterView> findCharacterByMatchAndUser(long idMatch, long idUser);

    /** Every inventory row of one character, in id order. */
    List<GamingInventoryItemsEntity> findInventory(long idMatch, long idCharacter);

    /** The story items of a story keyed by id: weight, is_consumabile, class gates, id_card. */
    Map<Long, ItemEntity> findItemsById(long idStory);

    /** Every {@code list_items_effects} row of the story, grouped by {@code id_item}, in id order. */
    Map<Long, List<ItemEffectEntity>> findItemEffectsByItemId(long idStory);

    /**
     * Removes one inventory row entirely. Both use-item and drop-item discard the
     * whole row: {@code amount} is never decremented (frozen Step 34 decision).
     */
    void deleteInventoryRow(long idMatch, long idRow);

    /** Step 35 — the character's food/magic/coin row, absent until something writes it. */
    Optional<EventExecutionStorePort.BackpackStats> findBackpack(long idMatch, long idCharacter);

    /**
     * Appends one {@code log_item_usage} row. The table carries {@code UNIQUE (id)},
     * so the id is allocated from the table-wide maximum, not per match.
     */
    void logItemUsage(long idMatch, long idCharacter, long idItem, String effectsJson);

    /** What the inventory service needs to know about the match. */
    record MatchInventoryView(long id, String uuid, String status, Long idStory) {
    }

    /** What the inventory service needs to know about the calling character. */
    record InventoryCharacterView(long id, String uuid, Long idClass,
                                  boolean isSleeping, boolean isComa, int weightMax) {
    }
}
