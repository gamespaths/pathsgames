package games.paths.core.entity.story;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;

/**
 * BaseMissionEntity - condition and completion fields shared by MissionEntity and MissionStepEntity.
 * v0.37.0 - the from/to range is gone: a mission has no operator, so it only ever meant equality.
 */
@MappedSuperclass
public abstract class BaseMissionEntity extends BaseStoryScopedEntity {

    @Column(name = "condition_key")
    private String conditionKey;

    @Column(name = "condition_value")
    private String conditionValue;

    // A PIPE-separated list, read as an AND. When it holds a value it wins over conditionValue.
    @Column(name = "condition_values")
    private String conditionValues;

    @Column(name = "id_event_completed")
    private Integer idEventCompleted;

    // ─── Getters / Setters ──────────────────────────────────────────────────────

    public String getConditionKey() { return conditionKey; }
    public void setConditionKey(String conditionKey) { this.conditionKey = conditionKey; }

    public String getConditionValue() { return conditionValue; }
    public void setConditionValue(String conditionValue) { this.conditionValue = conditionValue; }

    public String getConditionValues() { return conditionValues; }
    public void setConditionValues(String conditionValues) { this.conditionValues = conditionValues; }

    public Integer getIdEventCompleted() { return idEventCompleted; }
    public void setIdEventCompleted(Integer idEventCompleted) { this.idEventCompleted = idEventCompleted; }
}
