package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * MissionEntity - JPA entity mapped to the "list_missions" table.
 */
@Entity
@Table(name = "list_missions")
public class MissionEntity {

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

    @Column(name = "condition_value_from")
    private String conditionValueFrom;

    @Column(name = "condition_value_to")
    private String conditionValueTo;

    @Column(name = "id_text_name")
    private Integer idTextName;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

    @Column(name = "id_event_completed")
    private Integer idEventCompleted;

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

    public String getConditionValueFrom() { return conditionValueFrom; }
    public void setConditionValueFrom(String conditionValueFrom) { this.conditionValueFrom = conditionValueFrom; }

    public String getConditionValueTo() { return conditionValueTo; }
    public void setConditionValueTo(String conditionValueTo) { this.conditionValueTo = conditionValueTo; }

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

    public Integer getIdEventCompleted() { return idEventCompleted; }
    public void setIdEventCompleted(Integer idEventCompleted) { this.idEventCompleted = idEventCompleted; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
