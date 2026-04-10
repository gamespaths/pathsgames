package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * EventEffectEntity - JPA entity mapped to the "list_events_effects" table.
 */
@Entity
@Table(name = "list_events_effects")
public class EventEffectEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

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
        if (value == null) value = 0;
        if (target == null) target = "ALL";
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

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
