package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * EventEntity - JPA entity mapped to the "list_events" table.
 */
@Entity
@IdClass(StoryScopedEntityId.class)
@Table(name = "list_events")
public class EventEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    @Column(name = "id_specific_location")
    private Integer idSpecificLocation;

    @Column(nullable = false)
    private String type;

    @Column(name = "cost_enery")
    private Integer costEnery;

    @Column(name = "flag_end_time", nullable = false)
    private Integer flagEndTime;

    @Column(name = "characteristic_to_add")
    private String characteristicToAdd;

    @Column(name = "characteristic_to_remove")
    private String characteristicToRemove;

    @Column(name = "key_to_add")
    private String keyToAdd;

    @Column(name = "key_value_to_add")
    private String keyValueToAdd;

    @Column(name = "id_item_to_add")
    private Integer idItemToAdd;

    @Column(name = "id_weather")
    private Integer idWeather;

    @Column(name = "id_event_next")
    private Integer idEventNext;

    @Column(name = "coin_cost")
    private Integer coinCost;

    @PrePersist
    protected void onCreate() {
        if (type == null) type = "NORMAL";
        if (costEnery == null) costEnery = 0;
        if (flagEndTime == null) flagEndTime = 0;
        if (coinCost == null) coinCost = 0;
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @Override
    public Long getIdStory() { return super.getIdStory(); }

    @Override
    public void setIdStory(Long idStory) {
        super.setIdStory(idStory);
        this.idStoryPk = idStory;
    }



    public Integer getIdSpecificLocation() { return idSpecificLocation; }
    public void setIdSpecificLocation(Integer idSpecificLocation) { this.idSpecificLocation = idSpecificLocation; }



    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Integer getCostEnery() { return costEnery; }
    public void setCostEnery(Integer costEnery) { this.costEnery = costEnery; }

    public Integer getFlagEndTime() { return flagEndTime; }
    public void setFlagEndTime(Integer flagEndTime) { this.flagEndTime = flagEndTime; }

    public String getCharacteristicToAdd() { return characteristicToAdd; }
    public void setCharacteristicToAdd(String characteristicToAdd) { this.characteristicToAdd = characteristicToAdd; }

    public String getCharacteristicToRemove() { return characteristicToRemove; }
    public void setCharacteristicToRemove(String characteristicToRemove) { this.characteristicToRemove = characteristicToRemove; }

    public String getKeyToAdd() { return keyToAdd; }
    public void setKeyToAdd(String keyToAdd) { this.keyToAdd = keyToAdd; }

    public String getKeyValueToAdd() { return keyValueToAdd; }
    public void setKeyValueToAdd(String keyValueToAdd) { this.keyValueToAdd = keyValueToAdd; }

    public Integer getIdItemToAdd() { return idItemToAdd; }
    public void setIdItemToAdd(Integer idItemToAdd) { this.idItemToAdd = idItemToAdd; }

    public Integer getIdWeather() { return idWeather; }
    public void setIdWeather(Integer idWeather) { this.idWeather = idWeather; }

    public Integer getIdEventNext() { return idEventNext; }
    public void setIdEventNext(Integer idEventNext) { this.idEventNext = idEventNext; }

    public Integer getCoinCost() { return coinCost; }
    public void setCoinCost(Integer coinCost) { this.coinCost = coinCost; }

}
