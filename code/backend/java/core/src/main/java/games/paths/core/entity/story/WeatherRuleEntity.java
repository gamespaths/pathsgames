package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * WeatherRuleEntity - JPA entity mapped to the "list_weather_rules" table.
 */
@Entity
@Table(name = "list_weather_rules")
public class WeatherRuleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "id_text_name")
    private Integer idTextName;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

    @Column(nullable = false)
    private Integer probability;

    @Column(name = "cost_move_safe_location")
    private Integer costMoveSafeLocation;

    @Column(name = "cost_move_not_safe_location")
    private Integer costMoveNotSafeLocation;

    @Column(name = "condition_key")
    private String conditionKey;

    @Column(name = "condition_key_value")
    private String conditionKeyValue;

    @Column(name = "time_from")
    private Integer timeFrom;

    @Column(name = "time_to")
    private Integer timeTo;

    @Column(name = "id_text")
    private Integer idText;

    @Column(nullable = false)
    private Integer active;

    private Integer priority;

    @Column(name = "delta_energy")
    private Integer deltaEnergy;

    @Column(name = "id_event")
    private Integer idEvent;

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
        if (probability == null) probability = 0;
        if (costMoveSafeLocation == null) costMoveSafeLocation = 0;
        if (costMoveNotSafeLocation == null) costMoveNotSafeLocation = 0;
        if (active == null) active = 1;
        if (priority == null) priority = 0;
        if (deltaEnergy == null) deltaEnergy = 0;
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

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

    public Integer getProbability() { return probability; }
    public void setProbability(Integer probability) { this.probability = probability; }

    public Integer getCostMoveSafeLocation() { return costMoveSafeLocation; }
    public void setCostMoveSafeLocation(Integer costMoveSafeLocation) { this.costMoveSafeLocation = costMoveSafeLocation; }

    public Integer getCostMoveNotSafeLocation() { return costMoveNotSafeLocation; }
    public void setCostMoveNotSafeLocation(Integer costMoveNotSafeLocation) { this.costMoveNotSafeLocation = costMoveNotSafeLocation; }

    public String getConditionKey() { return conditionKey; }
    public void setConditionKey(String conditionKey) { this.conditionKey = conditionKey; }

    public String getConditionKeyValue() { return conditionKeyValue; }
    public void setConditionKeyValue(String conditionKeyValue) { this.conditionKeyValue = conditionKeyValue; }

    public Integer getTimeFrom() { return timeFrom; }
    public void setTimeFrom(Integer timeFrom) { this.timeFrom = timeFrom; }

    public Integer getTimeTo() { return timeTo; }
    public void setTimeTo(Integer timeTo) { this.timeTo = timeTo; }

    public Integer getIdText() { return idText; }
    public void setIdText(Integer idText) { this.idText = idText; }

    public Integer getActive() { return active; }
    public void setActive(Integer active) { this.active = active; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public Integer getDeltaEnergy() { return deltaEnergy; }
    public void setDeltaEnergy(Integer deltaEnergy) { this.deltaEnergy = deltaEnergy; }

    public Integer getIdEvent() { return idEvent; }
    public void setIdEvent(Integer idEvent) { this.idEvent = idEvent; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
