package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * GlobalRandomEventEntity - JPA entity mapped to the "list_global_random_events" table.
 */
@Entity
@IdClass(StoryScopedEntityId.class)
@Table(name = "list_global_random_events")
public class GlobalRandomEventEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

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

    @PrePersist
    protected void onCreate() {
        if (probability == null) probability = 0;
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

}
