package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * GlobalRandomEventEntity - JPA entity mapped to the "list_global_random_events" table.
 */
@Entity
@Table(name = "list_global_random_events")
public class GlobalRandomEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "condition_key")
    private String conditionKey;

    @Column(name = "condition_value")
    private String conditionValue;

    @Column(nullable = false)
    private Integer probability;

    @Column(name = "id_text")
    private Integer idText;

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

    public String getConditionKey() { return conditionKey; }
    public void setConditionKey(String conditionKey) { this.conditionKey = conditionKey; }

    public String getConditionValue() { return conditionValue; }
    public void setConditionValue(String conditionValue) { this.conditionValue = conditionValue; }

    public Integer getProbability() { return probability; }
    public void setProbability(Integer probability) { this.probability = probability; }

    public Integer getIdText() { return idText; }
    public void setIdText(Integer idText) { this.idText = idText; }

    public Integer getIdEvent() { return idEvent; }
    public void setIdEvent(Integer idEvent) { this.idEvent = idEvent; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
