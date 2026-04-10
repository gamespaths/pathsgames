package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * EventEffectEntity - JPA entity mapped to the "list_events_effects" table.
 */
@Entity
@Table(name = "list_events_effects")
public class EventEffectEntity extends BaseStoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_event", nullable = false)
    private Integer idEvent;

    private String statistics;

    private Integer value;

    private String target;

    @Column(name = "traits_to_add")
    private String traitsToAdd;

    @Column(name = "traits_to_remove")
    private String traitsToRemove;

    @Column(name = "target_class")
    private Integer targetClass;

    @Column(name = "id_item_target")
    private Integer idItemTarget;

    @Column(name = "item_action")
    private String itemAction;

    @PrePersist
    protected void onCreate() {
        if (value == null) value = 0;
        if (target == null) target = "ALL";
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }



    public Integer getIdEvent() { return idEvent; }
    public void setIdEvent(Integer idEvent) { this.idEvent = idEvent; }

    public String getStatistics() { return statistics; }
    public void setStatistics(String statistics) { this.statistics = statistics; }

    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }

    public String getTarget() { return target; }
    public void setTarget(String target) { this.target = target; }

    public String getTraitsToAdd() { return traitsToAdd; }
    public void setTraitsToAdd(String traitsToAdd) { this.traitsToAdd = traitsToAdd; }

    public String getTraitsToRemove() { return traitsToRemove; }
    public void setTraitsToRemove(String traitsToRemove) { this.traitsToRemove = traitsToRemove; }

    public Integer getTargetClass() { return targetClass; }
    public void setTargetClass(Integer targetClass) { this.targetClass = targetClass; }

    public Integer getIdItemTarget() { return idItemTarget; }
    public void setIdItemTarget(Integer idItemTarget) { this.idItemTarget = idItemTarget; }

    public String getItemAction() { return itemAction; }
    public void setItemAction(String itemAction) { this.itemAction = itemAction; }

}
