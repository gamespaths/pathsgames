package games.paths.adapters.rest.dto;

import games.paths.core.model.match.ItemInstanceInfo;

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

    public static ItemInstanceResponse fromModel(ItemInstanceInfo m) {
        ItemInstanceResponse r = new ItemInstanceResponse();
        r.uuid = m.getUuid();
        r.itemUuid = m.getItemUuid();
        r.name = m.getName();
        r.weight = m.getWeight();
        r.amount = m.getAmount();
        r.state = m.getState();
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
}
