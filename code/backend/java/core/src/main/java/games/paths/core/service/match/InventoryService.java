package games.paths.core.service.match;

import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.story.ItemEffectEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.model.match.EffectStatCodec;
import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionPort.StandaloneEffect;
import games.paths.core.port.match.EventExecutionPort.StatChange;
import games.paths.core.port.match.EventExecutionPort.TraitChange;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.InventoryPort;
import games.paths.core.port.match.InventoryStorePort;
import games.paths.core.port.match.InventoryStorePort.InventoryCharacterView;
import games.paths.core.port.match.InventoryStorePort.MatchInventoryView;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * InventoryService - Steps 34 and 35: what a character carries, and what it costs.
 *
 * <p>Everything item-shaped lives here — the validation order, the row removal, the
 * {@code log_item_usage} write, the listing and the resources. The application of the
 * effects themselves is delegated to {@link EventExecutionService}, in this same
 * package, so that an item moves a statistic through exactly the code an event uses
 * and trips exactly the same Step 30 edge states.</p>
 */
public class InventoryService implements InventoryPort {

    private final InventoryStorePort store;
    private final UserAccessPort userAccessPort;
    private final ContentQueryPort contentQueryPort;
    private final StoryReadPort storyReadPort;
    private final EventExecutionService effectEngine;

    public InventoryService(InventoryStorePort store,
                            UserAccessPort userAccessPort,
                            ContentQueryPort contentQueryPort,
                            StoryReadPort storyReadPort,
                            EventExecutionService effectEngine) {
        this.store = store;
        this.userAccessPort = userAccessPort;
        this.contentQueryPort = contentQueryPort;
        this.storyReadPort = storyReadPort;
        this.effectEngine = effectEngine;
    }

    // ── read ────────────────────────────────────────────────────────────────

    @Override
    public InventoryView listInventory(String matchUuid, String userUuid, String lang) {
        Ctx c = load(matchUuid, userUuid, false);
        List<ItemInstanceInfo> items = mapItems(c, lang);
        return new InventoryView(c.match.uuid(), c.actor.uuid(),
                items, ItemInstanceMapper.totalWeight(items), c.actor.weightMax());
    }

    @Override
    public ResourcesView getResources(String matchUuid, String userUuid) {
        Ctx c = load(matchUuid, userUuid, false);
        BackpackStats backpack = store.findBackpack(c.match.id(), c.actor.id())
                .orElse(new BackpackStats(0, 0, 0));
        int weight = ItemInstanceMapper.totalWeight(mapItems(c, null));
        return new ResourcesView(c.match.uuid(), c.actor.uuid(),
                backpack.food(), backpack.magic(), backpack.coin(), weight, c.actor.weightMax());
    }

    // ── write ───────────────────────────────────────────────────────────────

    @Override
    public EventExecutionResult useItem(String matchUuid, String userUuid,
                                        String itemInstanceUuid, String lang) {
        Ctx c = load(matchUuid, userUuid, true);
        GamingInventoryItemsEntity row = findOwnRow(c, itemInstanceUuid);
        ItemEntity item = resolveItem(c, row);

        if (!isConsumable(item)) {
            throw fail(InventoryException.Code.ITEM_NOT_CONSUMABLE,
                    "This item cannot be used, only carried");
        }
        checkClassGate(item, c.actor.idClass());

        List<StandaloneEffect> effects = standaloneEffects(c, item);
        CardInfo card = resolveCard(c, item.getIdCard(), lang);

        // The row goes first: an item whose effects grant the same item back cannot be
        // spent twice, and the row is gone even if the effect chain ends in a coma.
        store.deleteInventoryRow(c.match.id(), row.getId());

        EventExecutionResult result =
                effectEngine.applyStandaloneEffects(c.match.id(), c.actor.id(), effects, card,
                        lang, true);
        store.logItemUsage(c.match.id(), c.actor.id(), item.getId(), toEffectsJson(result));
        return result;
    }

    @Override
    public DropItemResult dropItem(String matchUuid, String userUuid, String itemInstanceUuid) {
        Ctx c = load(matchUuid, userUuid, true);
        GamingInventoryItemsEntity row = findOwnRow(c, itemInstanceUuid);
        // No consumable gate and no class gate here: a non-consumable item must be
        // droppable, that is the whole point of carrying one.
        ItemEntity item = c.itemsById().get(row.getIdItem());
        int amount = ItemInstanceMapper.unitAmount(row.getAmount());

        store.deleteInventoryRow(c.match.id(), row.getId());
        // The row is gone, so the cached list is stale: the weight reported below has to be
        // the one AFTER the drop, which is exactly what the caller will read back.
        c.invalidateInventory();

        List<ItemInstanceInfo> remaining = mapItems(c, null);
        return new DropItemResult(c.match.uuid(), c.actor.uuid(), row.getUuid(),
                item != null ? item.getUuid() : null, amount,
                ItemInstanceMapper.totalWeight(remaining), c.actor.weightMax());
    }

    // ── validation ──────────────────────────────────────────────────────────

    /**
     * Resolves user, match and character, in the order the other gameplay services use.
     * {@code requireAction} adds the gates an action needs and a read does not: the match
     * must be running and the character must be awake and out of coma.
     */
    private Ctx load(String matchUuid, String userUuid, boolean requireAction) {
        Long userId = userUuid == null ? null
                : userAccessPort.findByUuid(userUuid).map(UserAccessPort.UserView::id).orElse(null);
        if (userId == null) {
            throw notFound();
        }
        MatchInventoryView match = store.findMatchByUuid(matchUuid).orElseThrow(InventoryService::notFound);
        InventoryCharacterView actor = store.findCharacterByMatchAndUser(match.id(), userId)
                .orElseThrow(InventoryService::notFound);
        if (requireAction) {
            if (!MatchStatuses.RUNNING.equals(match.status())) {
                throw fail(InventoryException.Code.MATCH_NOT_RUNNING, "The match is not running");
            }
            if (actor.isComa()) {
                throw fail(InventoryException.Code.COMA, "The character is in a coma");
            }
            if (actor.isSleeping()) {
                throw fail(InventoryException.Code.SLEEPING, "The character is sleeping");
            }
        }
        return new Ctx(match, actor);
    }

    /**
     * Only ever searches the caller's own rows, so another player's item is
     * indistinguishable from one that does not exist. That masking IS the
     * "the row belongs to the caller" rule — there is no comparison to forget.
     */
    private GamingInventoryItemsEntity findOwnRow(Ctx c, String itemInstanceUuid) {
        if (itemInstanceUuid == null || itemInstanceUuid.isBlank()) {
            throw fail(InventoryException.Code.ITEM_NOT_FOUND, "Item not found in the inventory");
        }
        for (GamingInventoryItemsEntity row : c.inventory()) {
            if (itemInstanceUuid.equals(row.getUuid())) {
                return row;
            }
        }
        throw fail(InventoryException.Code.ITEM_NOT_FOUND, "Item not found in the inventory");
    }

    /**
     * A row whose story item is gone — or is authored without an id — is reported as a
     * missing item rather than carried further: everything downstream (the effect lookup,
     * the usage log) is keyed by that id. Note that a match with no story resolves an empty
     * item map, so passing this check also guarantees {@code idStory} is non-null.
     */
    private ItemEntity resolveItem(Ctx c, GamingInventoryItemsEntity row) {
        ItemEntity item = row.getIdItem() == null ? null : c.itemsById().get(row.getIdItem());
        if (item == null || item.getId() == null) {
            throw fail(InventoryException.Code.ITEM_NOT_FOUND, "Item not found in the story");
        }
        return item;
    }

    private static boolean isConsumable(ItemEntity item) {
        Integer flag = item.getIsConsumabile();
        return flag != null && flag == 1;
    }

    /**
     * A restriction of {@code 0} or {@code null} means "no restriction": the CRUD writes a
     * raw 0 while the importer normalises 0 to null, and both have to read as unset.
     */
    private void checkClassGate(ItemEntity item, Long idClass) {
        Integer permitted = item.getIdClassPermitted();
        Integer prohibited = item.getIdClassProhibited();
        if (permitted != null && permitted > 0
                && (idClass == null || permitted.longValue() != idClass)) {
            throw fail(InventoryException.Code.ITEM_CLASS_NOT_PERMITTED,
                    "The character's class cannot use this item");
        }
        if (prohibited != null && prohibited > 0
                && idClass != null && prohibited.longValue() == idClass) {
            throw fail(InventoryException.Code.ITEM_CLASS_PROHIBITED,
                    "The character's class is forbidden from using this item");
        }
    }

    // ── mapping ─────────────────────────────────────────────────────────────

    private List<ItemInstanceInfo> mapItems(Ctx c, String lang) {
        return ItemInstanceMapper.build(c.inventory(), c.itemsById(), storyReadPort,
                contentQueryPort, c.match.idStory(), lang, new HashMap<>());
    }

    /** Maps {@code list_items_effects} rows onto what the engine consumes. */
    private List<StandaloneEffect> standaloneEffects(Ctx c, ItemEntity item) {
        List<StandaloneEffect> out = new ArrayList<>();
        List<ItemEffectEntity> rows = store.findItemEffectsByItemId(c.match.idStory())
                .getOrDefault(item.getId(), List.of());
        for (ItemEffectEntity e : rows) {
            out.add(new StandaloneEffect(
                    e.getUuid(),
                    EffectStatCodec.normalize(e.getEffectCode()),
                    e.getEffectValue(),
                    e.getTraitsToAdd(),
                    e.getTraitsToRemove(),
                    e.getIdCard()));
        }
        return out;
    }

    private CardInfo resolveCard(Ctx c, Integer idCard, String lang) {
        if (contentQueryPort == null || idCard == null || c.match.idStory() == null) {
            return null;
        }
        String resolved = (lang == null || lang.isBlank()) ? ItemInstanceMapper.DEFAULT_LANG : lang;
        return contentQueryPort.getCardByStoryIdAndCardId(c.match.idStory(), idCard, resolved);
    }

    // ── log payload ─────────────────────────────────────────────────────────

    /**
     * Serialises what the usage changed, for {@code log_item_usage.effects_json}.
     *
     * <p>Hand-rolled on purpose: {@code core} has no Jackson on its classpath, and the
     * payload only ever holds uuids, lowercase statistic tokens and integers. Key order
     * is fixed so the column stays diffable.</p>
     */
    static String toEffectsJson(EventExecutionResult r) {
        StringBuilder sb = new StringBuilder("{\"statChanges\":[");
        boolean first = true;
        for (StatChange s : r.statChanges()) {
            if (!first) sb.append(',');
            first = false;
            sb.append("{\"characterUuid\":").append(quote(s.characterUuid()))
              .append(",\"statistic\":").append(quote(s.statistic()))
              .append(",\"before\":").append(s.before())
              .append(",\"after\":").append(s.after())
              .append(",\"delta\":").append(s.delta()).append('}');
        }
        sb.append("],\"traitChanges\":[");
        first = true;
        for (TraitChange t : r.traitChanges()) {
            if (!first) sb.append(',');
            first = false;
            sb.append("{\"characterUuid\":").append(quote(t.characterUuid()))
              .append(",\"traitUuid\":").append(quote(t.traitUuid()))
              .append(",\"action\":").append(quote(t.action())).append('}');
        }
        sb.append("],\"sadnessOverflow\":")
          .append(!r.edgeState().sadnessOverflowUuids().isEmpty())
          .append(",\"comaTriggered\":").append(r.comaTriggered())
          .append('}');
        return sb.toString();
    }

    /** Minimal JSON string escaping; control characters are dropped rather than encoded. */
    private static String quote(String value) {
        if (value == null) {
            return "null";
        }
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch == '"' || ch == '\\') {
                sb.append('\\').append(ch);
            } else if (ch >= ' ') {
                sb.append(ch);
            }
        }
        return sb.append('"').toString();
    }

    // ── errors ──────────────────────────────────────────────────────────────

    private static InventoryException notFound() {
        return fail(InventoryException.Code.MATCH_NOT_FOUND, "Match not found");
    }

    private static InventoryException fail(InventoryException.Code code, String message) {
        return new InventoryException(code, message);
    }

    /** Per-request state: the match, the caller's character, and the two lazily loaded maps. */
    private final class Ctx {
        private final MatchInventoryView match;
        private final InventoryCharacterView actor;
        private List<GamingInventoryItemsEntity> inventory;
        private Map<Long, ItemEntity> itemsById;

        private Ctx(MatchInventoryView match, InventoryCharacterView actor) {
            this.match = match;
            this.actor = actor;
        }

        private void invalidateInventory() {
            inventory = null;
        }

        private List<GamingInventoryItemsEntity> inventory() {
            if (inventory == null) {
                inventory = store.findInventory(match.id(), actor.id());
            }
            return inventory;
        }

        private Map<Long, ItemEntity> itemsById() {
            if (itemsById == null) {
                itemsById = match.idStory() == null ? Map.of() : store.findItemsById(match.idStory());
            }
            return itemsById;
        }
    }
}
