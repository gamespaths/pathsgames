package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * EventEntity - JPA entity mapped to the "list_events" table.
 */
@Entity
@Table(name = "list_events")
public class EventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "id_specific_location")
    private Integer idSpecificLocation;

    @Column(name = "id_text_name")
    private Integer idTextName;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

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

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
        if (type == null) type = "NORMAL";
        if (costEnery == null) costEnery = 0;
        if (flagEndTime == null) flagEndTime = 0;
        if (coinCost == null) coinCost = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        tsUpdate = java.time.Instant.now().toString();
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public Long getIdStory() { return idStory; }
    public void setIdStory(Long idStory) { this.idStory = idStory; }

    public Integer getIdSpecificLocation() { return idSpecificLocation; }
    public void setIdSpecificLocation(Integer idSpecificLocation) { this.idSpecificLocation = idSpecificLocation; }

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

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

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
