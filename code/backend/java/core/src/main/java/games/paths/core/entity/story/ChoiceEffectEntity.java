package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ChoiceEffectEntity - JPA entity mapped to the "list_choices_effects" table.
 *
 * <p>One row is one thing a selected option does. {@code flagGroup} decides who it lands on:
 * 0 (the default) the acting character alone, 1 every character standing in the actor's
 * location — the same set an event effect's {@code target=ALL} resolves (INV-27).</p>
 *
 * <p>The five {@code idEvent}/{@code idLocation}/{@code idWeather}/{@code idItemTarget}/
 * {@code itemAction} columns arrived in V0.32.0 and are the exact twins of their
 * {@link EventEffectEntity} counterparts, so the Step 32 resolution reuses the Step 29
 * effect helpers verbatim. All are EFFECTS, never conditions: {@code idWeather} <em>sets</em>
 * the match weather, {@code idEvent} <em>runs</em> that event with its whole chain.</p>
 */
@Entity
@Table(name = "list_choices_effects")
@IdClass(StoryScopedEntityId.class)
public class ChoiceEffectEntity extends BaseStoryScopedEntity {

    @Column(name = "id_choices", nullable = false)
    private Integer idChoices;

    @Column(name = "id_scelta")
    private Integer idScelta;

    @Column(name = "flag_group", nullable = false)
    private Integer flagGroup;

    private String statistics;

    private Integer value;

    @Column(name = "id_text")
    private Integer idText;

    @Column(name = "\"key\"")
    private String key;

    @Column(name = "value_to_add")
    private String valueToAdd;

    @Column(name = "value_to_remove")
    private String valueToRemove;

    // ── v0.32.0 effect targets — twins of the list_events_effects columns ──

    /** EFFECT: runs that event inline, with its whole {@code idEventNext} chain. */
    @Column(name = "id_event")
    private Integer idEvent;

    /** EFFECT: forced movement of the recipients — no adjacency, no energy cost. */
    @Column(name = "id_location")
    private Integer idLocation;

    /** EFFECT: SETS the match weather. Applied once per row, the match being its scope. */
    @Column(name = "id_weather")
    private Integer idWeather;

    @Column(name = "id_item_target")
    private Integer idItemTarget;

    /** ADD or REMOVE, for {@link #idItemTarget}. */
    @Column(name = "item_action")
    private String itemAction;

    @PrePersist
    protected void onCreate() {
        if (flagGroup == null) flagGroup = 0;
        if (value == null) value = 0;
    }

    // === Getters & Setters ===

    public Integer getIdChoices() { return idChoices; }
    public void setIdChoices(Integer idChoices) { this.idChoices = idChoices; }

    public Integer getIdScelta() { return idScelta; }
    public void setIdScelta(Integer idScelta) { this.idScelta = idScelta; }

    public Integer getFlagGroup() { return flagGroup; }
    public void setFlagGroup(Integer flagGroup) { this.flagGroup = flagGroup; }

    public String getStatistics() { return statistics; }
    public void setStatistics(String statistics) { this.statistics = statistics; }

    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }

    public Integer getIdText() { return idText; }
    public void setIdText(Integer idText) { this.idText = idText; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getValueToAdd() { return valueToAdd; }
    public void setValueToAdd(String valueToAdd) { this.valueToAdd = valueToAdd; }

    public String getValueToRemove() { return valueToRemove; }
    public void setValueToRemove(String valueToRemove) { this.valueToRemove = valueToRemove; }

    public Integer getIdEvent() { return idEvent; }
    public void setIdEvent(Integer idEvent) { this.idEvent = idEvent; }

    public Integer getIdLocation() { return idLocation; }
    public void setIdLocation(Integer idLocation) { this.idLocation = idLocation; }

    public Integer getIdWeather() { return idWeather; }
    public void setIdWeather(Integer idWeather) { this.idWeather = idWeather; }

    public Integer getIdItemTarget() { return idItemTarget; }
    public void setIdItemTarget(Integer idItemTarget) { this.idItemTarget = idItemTarget; }

    public String getItemAction() { return itemAction; }
    public void setItemAction(String itemAction) { this.itemAction = itemAction; }

}
