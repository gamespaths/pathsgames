package games.paths.adapters.rest.dto;

import games.paths.core.port.match.InventoryPort;

/**
 * JSON projection of GET /api/gameplay/{uuidMatch}/resources (Step 35).
 *
 * <p>Plain numbers, deliberately with no card: resources are not story entities and
 * have no {@code id_card}. Food, magic and coins weigh nothing — only items do.</p>
 */
public class ResourcesResponse {

    private String matchUuid;
    private String characterUuid;
    private Integer food;
    private Integer magic;
    private Integer coin;
    private Integer weight;
    private Integer weightMax;

    public static ResourcesResponse fromModel(InventoryPort.ResourcesView m) {
        ResourcesResponse r = new ResourcesResponse();
        r.matchUuid = m.matchUuid();
        r.characterUuid = m.characterUuid();
        r.food = m.food();
        r.magic = m.magic();
        r.coin = m.coin();
        r.weight = m.weight();
        r.weightMax = m.weightMax();
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public void setMatchUuid(String matchUuid) { this.matchUuid = matchUuid; }
    public String getCharacterUuid() { return characterUuid; }
    public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
    public Integer getFood() { return food; }
    public void setFood(Integer food) { this.food = food; }
    public Integer getMagic() { return magic; }
    public void setMagic(Integer magic) { this.magic = magic; }
    public Integer getCoin() { return coin; }
    public void setCoin(Integer coin) { this.coin = coin; }
    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }
    public Integer getWeightMax() { return weightMax; }
    public void setWeightMax(Integer weightMax) { this.weightMax = weightMax; }
}
