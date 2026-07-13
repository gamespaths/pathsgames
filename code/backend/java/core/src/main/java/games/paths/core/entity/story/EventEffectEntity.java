package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * EventEffectEntity - JPA entity mapped to the "list_events_effects" table.
 *
 * <p>Step 29 made this the single <em>effect</em> side of an event: everything an
 * event does to the match state is authored here, one row per effect, and the
 * inherited {@code idCard} is the row's narrative card. The <em>condition</em>
 * side lives entirely on {@link EventEntity}.</p>
 */
@Entity
@Table(name = "list_events_effects")
@IdClass(StoryScopedEntityId.class)
public class EventEffectEntity extends BaseStoryScopedEntity {

    @Column(name = "id_event", nullable = false)
    private Integer idEvent;

    /** life, energy, exp, sad, dex, int, cos, food, magic or coin. */
    private String statistics;

    private Integer value;

    /** ALL (every character in the actor's location) or ONLY_ONE (the actor). */
    private String target;

    @Column(name = "traits_to_add")
    private String traitsToAdd;

    @Column(name = "traits_to_remove")
    private String traitsToRemove;

    /** Narrows the recipients of this effect to a single class. */
    @Column(name = "target_class")
    private Integer targetClass;

    @Column(name = "id_item_target")
    private Integer idItemTarget;

    /** ADD or REMOVE, applied to {@link #idItemTarget}. */
    @Column(name = "item_action")
    private String itemAction;

    /**
     * EFFECT (v0.29.0): sets the match's current weather.
     *
     * <p>Beware the mirror: {@link EventEntity#getIdWeather()} carries the same name
     * but the opposite direction — there it is a <em>condition</em>.</p>
     */
    @Column(name = "id_weather")
    private Integer idWeather;

    /** EFFECT (v0.29.0, moved off list_events): registry key to upsert. */
    @Column(name = "key_to_add")
    private String keyToAdd;

    /** EFFECT (v0.29.0, moved off list_events): value written under {@link #keyToAdd}. */
    @Column(name = "key_value_to_add")
    private String keyValueToAdd;

    /** EFFECT (v0.29.0, moved off list_events). */
    @Column(name = "characteristic_to_add")
    private String characteristicToAdd;

    /** EFFECT (v0.29.0, moved off list_events). */
    @Column(name = "characteristic_to_remove")
    private String characteristicToRemove;

    @PrePersist
    protected void onCreate() {
        if (value == null) value = 0;
        if (target == null) target = "ALL";
    }

    // === Getters & Setters ===

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

    public Integer getIdWeather() { return idWeather; }
    public void setIdWeather(Integer idWeather) { this.idWeather = idWeather; }

    public String getKeyToAdd() { return keyToAdd; }
    public void setKeyToAdd(String keyToAdd) { this.keyToAdd = keyToAdd; }

    public String getKeyValueToAdd() { return keyValueToAdd; }
    public void setKeyValueToAdd(String keyValueToAdd) { this.keyValueToAdd = keyValueToAdd; }

    public String getCharacteristicToAdd() { return characteristicToAdd; }
    public void setCharacteristicToAdd(String characteristicToAdd) { this.characteristicToAdd = characteristicToAdd; }

    public String getCharacteristicToRemove() { return characteristicToRemove; }
    public void setCharacteristicToRemove(String characteristicToRemove) { this.characteristicToRemove = characteristicToRemove; }

}
