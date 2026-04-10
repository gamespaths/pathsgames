package games.paths.core.entity.story;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;

/**
 * BaseMissionEntity - Intermediate base class for mission-related entities.
 *
 * <p>Extends {@link BaseStoryEntity} and adds the four condition/completion
 * fields shared by both {@code MissionEntity} and {@code MissionStepEntity}:</p>
 * <ul>
 *   <li>{@code conditionKey}       — the key that identifies the condition</li>
 *   <li>{@code conditionValueFrom} — starting value of the condition range</li>
 *   <li>{@code conditionValueTo}   — ending value of the condition range</li>
 *   <li>{@code idEventCompleted}   — reference to the event triggered on completion</li>
 * </ul>
 */
@MappedSuperclass
public abstract class BaseMissionEntity extends BaseStoryEntity {

    @Column(name = "condition_key")
    private String conditionKey;

    @Column(name = "condition_value_from")
    private String conditionValueFrom;

    @Column(name = "condition_value_to")
    private String conditionValueTo;

    @Column(name = "id_event_completed")
    private Integer idEventCompleted;

    // ─── Getters / Setters ──────────────────────────────────────────────────────

    public String getConditionKey() { return conditionKey; }
    public void setConditionKey(String conditionKey) { this.conditionKey = conditionKey; }

    public String getConditionValueFrom() { return conditionValueFrom; }
    public void setConditionValueFrom(String conditionValueFrom) { this.conditionValueFrom = conditionValueFrom; }

    public String getConditionValueTo() { return conditionValueTo; }
    public void setConditionValueTo(String conditionValueTo) { this.conditionValueTo = conditionValueTo; }

    public Integer getIdEventCompleted() { return idEventCompleted; }
    public void setIdEventCompleted(Integer idEventCompleted) { this.idEventCompleted = idEventCompleted; }
}
