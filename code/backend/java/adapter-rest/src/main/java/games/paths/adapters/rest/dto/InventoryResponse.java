package games.paths.adapters.rest.dto;

import games.paths.core.model.match.ItemInstanceInfo;
import games.paths.core.port.match.InventoryPort;

import java.util.ArrayList;
import java.util.List;

/**
 * JSON projection of GET /api/gameplay/{uuidMatch}/inventory (Step 34).
 *
 * <p>The {@code items[]} are built by the very same mapper the match {@code /info}
 * endpoint uses, so the two payloads carry identical item objects.</p>
 */
public class InventoryResponse {

    private String matchUuid;
    private String characterUuid;
    private List<ItemInstanceResponse> items = new ArrayList<>();
    private Integer weight;
    private Integer weightMax;

    public static InventoryResponse fromModel(InventoryPort.InventoryView m) {
        InventoryResponse r = new InventoryResponse();
        r.matchUuid = m.matchUuid();
        r.characterUuid = m.characterUuid();
        for (ItemInstanceInfo i : m.items()) {
            r.items.add(ItemInstanceResponse.fromModel(i));
        }
        r.weight = m.weight();
        r.weightMax = m.weightMax();
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public void setMatchUuid(String matchUuid) { this.matchUuid = matchUuid; }
    public String getCharacterUuid() { return characterUuid; }
    public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
    public List<ItemInstanceResponse> getItems() { return items; }
    public void setItems(List<ItemInstanceResponse> items) { this.items = items; }
    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }
    public Integer getWeightMax() { return weightMax; }
    public void setWeightMax(Integer weightMax) { this.weightMax = weightMax; }
}
