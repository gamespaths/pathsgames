package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * LocationNeighborEntity - JPA entity mapped to the "list_locations_neighbors" table.
 */
@Entity
@Table(name = "list_locations_neighbors")
@IdClass(StoryScopedEntityId.class)
public class LocationNeighborEntity extends BaseStoryScopedEntity {

    @Column(name = "id_location_from", nullable = false)
    private Integer idLocationFrom;

    @Column(name = "id_location_to", nullable = false)
    private Integer idLocationTo;

    @Column(nullable = false)
    private String direction;

    @Column(name = "flag_back", nullable = false)
    private Integer flagBack;

    @Column(name = "condition_registry_key")
    private String conditionRegistryKey;

    @Column(name = "condition_registry_value")
    private String conditionRegistryValue;

    @Column(name = "energy_cost")
    private Integer energyCost;

    /** v0.35.3 - resources the mover pays for this edge; energy stays above. */
    @Column(name = "cost_food")
    private Integer costFood;

    @Column(name = "cost_magic")
    private Integer costMagic;

    @Column(name = "cost_coin")
    private Integer costCoin;

    @Column(name = "id_text_go")
    private Integer idTextGo;

    @Column(name = "id_text_back")
    private Integer idTextBack;

    @Column(name = "id_card_back")
    private Integer idCardBack;

    @PrePersist
    protected void onCreate() {
        if (flagBack == null) flagBack = 0;
        if (energyCost == null) energyCost = 0;
        if (costFood == null) costFood = 0;
        if (costMagic == null) costMagic = 0;
        if (costCoin == null) costCoin = 0;
    }

    // === Getters & Setters ===

    public Integer getIdLocationFrom() { return idLocationFrom; }
    public void setIdLocationFrom(Integer idLocationFrom) { this.idLocationFrom = idLocationFrom; }

    public Integer getIdLocationTo() { return idLocationTo; }
    public void setIdLocationTo(Integer idLocationTo) { this.idLocationTo = idLocationTo; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public Integer getFlagBack() { return flagBack; }
    public void setFlagBack(Integer flagBack) { this.flagBack = flagBack; }

    public String getConditionRegistryKey() { return conditionRegistryKey; }
    public void setConditionRegistryKey(String conditionRegistryKey) { this.conditionRegistryKey = conditionRegistryKey; }

    public String getConditionRegistryValue() { return conditionRegistryValue; }
    public void setConditionRegistryValue(String conditionRegistryValue) { this.conditionRegistryValue = conditionRegistryValue; }

    public Integer getEnergyCost() { return energyCost; }
    public void setEnergyCost(Integer energyCost) { this.energyCost = energyCost; }

    public Integer getCostFood() { return costFood; }
    public void setCostFood(Integer costFood) { this.costFood = costFood; }

    public Integer getCostMagic() { return costMagic; }
    public void setCostMagic(Integer costMagic) { this.costMagic = costMagic; }

    public Integer getCostCoin() { return costCoin; }
    public void setCostCoin(Integer costCoin) { this.costCoin = costCoin; }

    public Integer getIdTextGo() { return idTextGo; }
    public void setIdTextGo(Integer idTextGo) { this.idTextGo = idTextGo; }

    public Integer getIdTextBack() { return idTextBack; }
    public void setIdTextBack(Integer idTextBack) { this.idTextBack = idTextBack; }

    public Integer getIdCardBack() { return idCardBack; }
    public void setIdCardBack(Integer idCardBack) { this.idCardBack = idCardBack; }

}
