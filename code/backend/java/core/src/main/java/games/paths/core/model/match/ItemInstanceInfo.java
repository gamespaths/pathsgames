package games.paths.core.model.match;

import games.paths.core.model.story.CardInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * ItemInstanceInfo - Domain model describing a single item carried by a
 * character inside a match (one row of {@code gaming_inventory_items} joined
 * with its story {@code list_items} definition).
 *
 * <p>Step 27 — exposed inside the player object of the match {@code /info}
 * endpoint and used to compute the character's current carried weight.</p>
 */
public class ItemInstanceInfo {

    private String uuid;       // inventory-row uuid
    private String itemUuid;   // story item uuid
    private String name;       // resolved localised name (nullable)
    private Integer weight;    // unit weight from the story item
    private Integer amount;    // quantity carried
    private String state;      // ACTIVE, ...

    /**
     * Step 34 — the story card of the item, and the card object resolved with it.
     * The id alone is not enough: react-game never resolves a card by id, it
     * consumes the embedded object (see MovementCard reading {@code location.card}).
     */
    private Integer idCard;
    private CardInfo card;

    /** Step 34 — only a consumable item can be used; a non-consumable one is merely carried. */
    private Boolean isConsumabile;

    /**
     * Step 35 — what using this item promises: its {@code list_items_effects} rows, reduced
     * to statistic and value. Empty when the item carries no effect at all, and empty (not
     * null) on the masked inventories of the other players — the board reads it without a
     * null check on every row.
     */
    private List<ItemEffectPreview> effects = new ArrayList<>();

    /**
     * v0.35.1 — the three authored quantities of the story item, as the board needs to read
     * them BEFORE acting: how many units may be held at once (null or 0 = no limit), how
     * many one drop puts down and how many one usage spends (null = one).
     *
     * <p>They are reported, not enforced, here: the gates stay server-side. The board uses
     * them to write "2/3" beside a capped item and to grey out a use the engine would only
     * refuse with {@code ITEM_NOT_ENOUGH} a moment later.</p>
     */
    private Integer maxPerCharacter;
    private Integer amountDrop;
    private Integer amountUse;

    public ItemInstanceInfo() {
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getItemUuid() { return itemUuid; }
    public void setItemUuid(String itemUuid) { this.itemUuid = itemUuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }

    public Integer getAmount() { return amount; }
    public void setAmount(Integer amount) { this.amount = amount; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfo getCard() { return card; }
    public void setCard(CardInfo card) { this.card = card; }

    public Boolean getIsConsumabile() { return isConsumabile; }
    public void setIsConsumabile(Boolean isConsumabile) { this.isConsumabile = isConsumabile; }

    public Integer getMaxPerCharacter() { return maxPerCharacter; }
    public void setMaxPerCharacter(Integer maxPerCharacter) { this.maxPerCharacter = maxPerCharacter; }

    public Integer getAmountDrop() { return amountDrop; }
    public void setAmountDrop(Integer amountDrop) { this.amountDrop = amountDrop; }

    public Integer getAmountUse() { return amountUse; }
    public void setAmountUse(Integer amountUse) { this.amountUse = amountUse; }

    public List<ItemEffectPreview> getEffects() { return effects; }
    public void setEffects(List<ItemEffectPreview> effects) {
        this.effects = effects == null ? new ArrayList<>() : effects;
    }
}
