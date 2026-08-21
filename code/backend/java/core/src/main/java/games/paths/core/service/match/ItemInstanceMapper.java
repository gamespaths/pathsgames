package games.paths.core.service.match;

import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ItemInstanceMapper - resolves {@code gaming_inventory_items} rows into
 * {@link ItemInstanceInfo}, joining each row with its story {@code list_items}
 * definition. Step 34.
 *
 * <p>Extracted out of {@link CharacterMapper} so that the {@code items[]} of the
 * match {@code /info} endpoint and the {@code items[]} of
 * {@code GET /api/gameplay/{uuid}/inventory} are guaranteed identical field for
 * field — they are literally the same code.</p>
 */
final class ItemInstanceMapper {

    static final String DEFAULT_LANG = "en";

    private ItemInstanceMapper() {
    }

    /**
     * Maps inventory rows, resolving weight, consumability, the localised name and
     * the item card.
     *
     * @param contentQueryPort may be null — the card then stays null and only
     *                         {@code idCard} is reported
     * @param lang             null or blank falls back to {@value #DEFAULT_LANG}
     * @param cardCache        one cache per request, so N items sharing a card cost
     *                         one lookup; may be null
     */
    @SuppressWarnings("java:S107") // a mapper collaborator list, not a behaviour switchboard
    static List<ItemInstanceInfo> build(List<GamingInventoryItemsEntity> inventory,
                                        Map<Long, ItemEntity> itemById,
                                        StoryReadPort storyReadPort,
                                        ContentQueryPort contentQueryPort,
                                        Long storyId,
                                        String lang,
                                        Map<Integer, CardInfo> cardCache) {
        List<ItemInstanceInfo> items = new ArrayList<>();
        if (inventory == null) {
            return items;
        }
        String resolvedLang = (lang == null || lang.isBlank()) ? DEFAULT_LANG : lang;
        Map<Integer, CardInfo> cache = cardCache != null ? cardCache : new HashMap<>();
        for (GamingInventoryItemsEntity row : inventory) {
            ItemEntity item = row.getIdItem() != null && itemById != null
                    ? itemById.get(row.getIdItem()) : null;
            ItemInstanceInfo info = new ItemInstanceInfo();
            info.setUuid(row.getUuid());
            info.setAmount(row.getAmount());
            info.setState(row.getState());
            if (item != null) {
                info.setItemUuid(item.getUuid());
                info.setWeight(item.getWeight());
                info.setIsConsumabile(isConsumabile(item));
                info.setIdCard(item.getIdCard());
                info.setCard(resolveCard(contentQueryPort, cache, storyId, item.getIdCard(), resolvedLang));
                if (storyId != null && item.getIdTextName() != null && storyReadPort != null) {
                    storyReadPort.findTextByStoryIdTextAndLang(storyId, item.getIdTextName(), resolvedLang)
                            .ifPresent(t -> info.setName(t.getShortText()));
                }
            } else {
                info.setWeight(0);
            }
            items.add(info);
        }
        return items;
    }

    /** Total carried weight = Σ (item.weight × amount) over the resolved items. */
    static int totalWeight(List<ItemInstanceInfo> items) {
        if (items == null) {
            return 0;
        }
        int total = 0;
        for (ItemInstanceInfo i : items) {
            total += unitWeight(i.getWeight()) * unitAmount(i.getAmount());
        }
        return total;
    }

    /** A null weight is 0 and a null amount is 1 — the movement gate must agree with this. */
    static int unitWeight(Integer weight) {
        return weight != null ? weight : 0;
    }

    static int unitAmount(Integer amount) {
        return amount != null ? amount : 1;
    }

    /** {@code is_consumabile} is stored as an integer flag; anything but 1 means "carried only". */
    private static Boolean isConsumabile(ItemEntity item) {
        Integer flag = item.getIsConsumabile();
        return flag != null && flag == 1;
    }

    private static CardInfo resolveCard(ContentQueryPort contentQueryPort,
                                        Map<Integer, CardInfo> cache,
                                        Long storyId,
                                        Integer idCard,
                                        String lang) {
        if (contentQueryPort == null || idCard == null || storyId == null) {
            return null;
        }
        return cache.computeIfAbsent(idCard,
                id -> contentQueryPort.getCardByStoryIdAndCardId(storyId, id, lang));
    }
}
