package games.paths.core.service.match;

import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.story.ItemEffectEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.model.match.EffectStatCodec;
import games.paths.core.model.match.ItemEffectPreview;
import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
    static List<ItemInstanceInfo> build(List<GamingInventoryItemsEntity> inventory,
                                        Map<Long, ItemEntity> itemById,
                                        StoryReadPort storyReadPort,
                                        ContentQueryPort contentQueryPort,
                                        Long storyId,
                                        String lang,
                                        Map<Integer, CardInfo> cardCache) {
        return build(inventory, itemById, storyReadPort, contentQueryPort, storyId, lang,
                cardCache, null);
    }

    /**
     * Step 35 — the same mapping, plus the effects each item promises.
     *
     * @param effectsByItem {@code list_items_effects} grouped by {@code id_item}, as
     *                      {@link #groupEffectsByItem} builds it; null leaves every
     *                      {@code effects[]} empty, which is what the pre-Step-35 overload
     *                      above does.
     */
    @SuppressWarnings("java:S107") // a mapper collaborator list, not a behaviour switchboard
    static List<ItemInstanceInfo> build(List<GamingInventoryItemsEntity> inventory,
                                        Map<Long, ItemEntity> itemById,
                                        StoryReadPort storyReadPort,
                                        ContentQueryPort contentQueryPort,
                                        Long storyId,
                                        String lang,
                                        Map<Integer, CardInfo> cardCache,
                                        Map<Long, List<ItemEffectEntity>> effectsByItem) {
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
                // v0.35.1 — the authored quantities travel as they are: null means "no cap"
                // and "one unit", and the board reads that the same way the engine does.
                info.setMaxPerCharacter(item.getMaxPerCharacter());
                info.setAmountDrop(item.getAmountDrop());
                info.setAmountUse(item.getAmountUse());
                info.setEffects(showsEffects(item)
                        ? previewEffects(effectsByItem, item.getId())
                        : new ArrayList<>());
            } else {
                info.setWeight(0);
            }
            items.add(info);
        }
        return items;
    }

    /**
     * Step 35 — the effect rows of one item, as the board may read them before the item is
     * used. Rows whose code lands outside the engine's vocabulary are dropped rather than
     * shown: {@code applyStat} discards them in silence, so promising one would be a
     * promise nothing keeps.
     */
    private static List<ItemEffectPreview> previewEffects(
            Map<Long, List<ItemEffectEntity>> effectsByItem, Long itemId) {
        List<ItemEffectPreview> out = new ArrayList<>();
        if (effectsByItem == null || itemId == null) {
            return out;
        }
        for (ItemEffectEntity e : effectsByItem.getOrDefault(itemId, List.of())) {
            if (!EffectStatCodec.isKnown(e.getEffectCode())) {
                continue;
            }
            out.add(new ItemEffectPreview(EffectStatCodec.normalize(e.getEffectCode()),
                    e.getEffectValue() != null ? e.getEffectValue() : 0));
        }
        return out;
    }

    /**
     * Groups a story's {@code list_items_effects} rows by {@code id_item}, in id order —
     * the same grouping {@code InventoryStoreAdapter.findItemEffectsByItemId} does for the
     * usage path, so the promise and the application list the effects in one order.
     */
    static Map<Long, List<ItemEffectEntity>> groupEffectsByItem(List<ItemEffectEntity> rows) {
        Map<Long, List<ItemEffectEntity>> byItem = new LinkedHashMap<>();
        if (rows == null) {
            return byItem;
        }
        List<ItemEffectEntity> sorted = new ArrayList<>(rows);
        sorted.sort(Comparator.comparing(ItemEffectEntity::getId,
                Comparator.nullsLast(Comparator.naturalOrder())));
        for (ItemEffectEntity e : sorted) {
            if (e.getIdItem() == null) {
                continue;
            }
            byItem.computeIfAbsent(e.getIdItem().longValue(), k -> new ArrayList<>()).add(e);
        }
        return byItem;
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

    /**
     * v0.35.0 — {@code flag_show_effects}: may the promise be read? Only an explicit 0
     * hides it. Null is the reading of every story authored before the column existed, and
     * those already shipped the promise — treating an absence as a refusal would take the
     * feature away from all of them at once.
     *
     * <p>It gates what is REPORTED, never what is applied: {@code useItem} does not consult
     * it, so a secret item still does exactly what its rows say.</p>
     */
    private static boolean showsEffects(ItemEntity item) {
        Integer flag = item.getFlagShowEffects();
        return flag == null || flag != 0;
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
