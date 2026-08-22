package games.paths.adapters.rest.dto;

import games.paths.core.model.match.ItemInstanceInfo;

import java.util.List;

/**
 * JSON projection of {@link ItemInstanceInfo}: a single item carried by a
 * character inside a match. Step 27.
 */
public class ItemInstanceResponse {

    private String uuid;
    private String itemUuid;
    private String name;
    private Integer weight;
    private Integer amount;
    private String state;
    /** Step 34 — the item's story card, and the card object resolved with it. */
    private Integer idCard;
    private CardInfoResponse card;
    /** Step 34 — false means the item is carried only; use-item refuses it. */
    private Boolean isConsumabile;
    /** Step 35 — what using it promises: statistic/value, before the engine clamps them. */
    private List<ItemEffectPreviewResponse> effects;
    /** v0.35.1 — the authored quantities: cap (null/0 = none), units per drop, per use. */
    private Integer maxPerCharacter;
    private Integer amountDrop;
    private Integer amountUse;

    public static ItemInstanceResponse fromModel(ItemInstanceInfo m) {
        ItemInstanceResponse r = new ItemInstanceResponse();
        r.uuid = m.getUuid();
        r.itemUuid = m.getItemUuid();
        r.name = m.getName();
        r.weight = m.getWeight();
        r.amount = m.getAmount();
        r.state = m.getState();
        r.idCard = m.getIdCard();
        r.card = CardInfoResponse.fromModel(m.getCard());
        r.isConsumabile = m.getIsConsumabile();
        r.effects = ItemEffectPreviewResponse.fromModels(m.getEffects());
        r.maxPerCharacter = m.getMaxPerCharacter();
        r.amountDrop = m.getAmountDrop();
        r.amountUse = m.getAmountUse();
        return r;
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
    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }
    public Boolean getIsConsumabile() { return isConsumabile; }
    public void setIsConsumabile(Boolean isConsumabile) { this.isConsumabile = isConsumabile; }
    public Integer getMaxPerCharacter() { return maxPerCharacter; }
    public void setMaxPerCharacter(Integer maxPerCharacter) { this.maxPerCharacter = maxPerCharacter; }
    public Integer getAmountDrop() { return amountDrop; }
    public void setAmountDrop(Integer amountDrop) { this.amountDrop = amountDrop; }
    public Integer getAmountUse() { return amountUse; }
    public void setAmountUse(Integer amountUse) { this.amountUse = amountUse; }
    public List<ItemEffectPreviewResponse> getEffects() { return effects; }
    public void setEffects(List<ItemEffectPreviewResponse> effects) { this.effects = effects; }
}
