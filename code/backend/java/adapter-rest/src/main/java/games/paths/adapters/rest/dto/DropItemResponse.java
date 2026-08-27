package games.paths.adapters.rest.dto;

import games.paths.core.port.match.InventoryPort;

/**
 * JSON projection of POST /api/gameplay/{uuidMatch}/inventory/drop-item (Step 34).
 *
 * <p>{@code amountDropped} is the whole row: dropping discards the row, it does not
 * decrement it — symmetrically with use-item.</p>
 */
public class DropItemResponse {

    private String matchUuid;
    private String characterUuid;
    private String itemInstanceUuid;
    private String itemUuid;
    private Integer amountDropped;
    private Integer weight;
    private Integer weightMax;
    /** Always true: the caller's inventory and carried weight both just changed. */
    private boolean refreshRecommended = true;

    public static DropItemResponse fromModel(InventoryPort.DropItemResult m) {
        DropItemResponse r = new DropItemResponse();
        r.matchUuid = m.matchUuid();
        r.characterUuid = m.characterUuid();
        r.itemInstanceUuid = m.itemInstanceUuid();
        r.itemUuid = m.itemUuid();
        r.amountDropped = m.amountDropped();
        r.weight = m.weight();
        r.weightMax = m.weightMax();
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public void setMatchUuid(String matchUuid) { this.matchUuid = matchUuid; }
    public String getCharacterUuid() { return characterUuid; }
    public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
    public String getItemInstanceUuid() { return itemInstanceUuid; }
    public void setItemInstanceUuid(String itemInstanceUuid) { this.itemInstanceUuid = itemInstanceUuid; }
    public String getItemUuid() { return itemUuid; }
    public void setItemUuid(String itemUuid) { this.itemUuid = itemUuid; }
    public Integer getAmountDropped() { return amountDropped; }
    public void setAmountDropped(Integer amountDropped) { this.amountDropped = amountDropped; }
    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }
    public Integer getWeightMax() { return weightMax; }
    public void setWeightMax(Integer weightMax) { this.weightMax = weightMax; }
    public boolean isRefreshRecommended() { return refreshRecommended; }
    public void setRefreshRecommended(boolean refreshRecommended) { this.refreshRecommended = refreshRecommended; }
}
