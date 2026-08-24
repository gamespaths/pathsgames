package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * EventEntity - JPA entity mapped to the "list_events" table.
 *
 * <p>Step 29 turned this table into the <em>condition</em> side of an event: every
 * column here that is not a cost or a link is read by
 * {@code EventAvailabilityChecker}, and they all combine in AND. The
 * <em>effect</em> side lives entirely on {@link EventEffectEntity}.</p>
 */
@Entity
@IdClass(StoryScopedEntityId.class)
@Table(name = "list_events")
public class EventEntity extends BaseStoryScopedEntity {

    /** CONDITION: the character must stand here. Null means the event has no location constraint. */
    @Column(name = "id_specific_location")
    private Integer idSpecificLocation;

    /** AUTOMATIC, FIRST, NORMAL or ONCE. Only NORMAL and ONCE are player-executable. */
    @Column(nullable = false)
    private String type;

    /** Energy the player pays to execute (column name keeps the historical "enery" typo). */
    @Column(name = "cost_enery")
    private Integer costEnery;

    @Column(name = "flag_end_time", nullable = false)
    private Integer flagEndTime;

    /**
     * DEPRECATED since v0.29.0: the engine ignores it. Items are granted and removed
     * through {@link EventEffectEntity#getIdItemTarget()} + {@code itemAction}. The
     * column survives only because it is used in a FK clause.
     */
    @Deprecated(since = "0.29.0")
    @Column(name = "id_item_to_add")
    private Integer idItemToAdd;

    /**
     * CONDITION: the match's current weather must equal this.
     *
     * <p>Beware the mirror: {@link EventEffectEntity#getIdWeather()} carries the same
     * name but the opposite direction — it <em>sets</em> the match weather.</p>
     */
    @Column(name = "id_weather")
    private Integer idWeather;

    /** Chained event executed right after this one. Loops are bounded by the executor. */
    @Column(name = "id_event_next")
    private Integer idEventNext;

    /** Coins the player pays to execute (v0.35.3: was {@code coin_cost}). */
    @Column(name = "cost_coin")
    private Integer costCoin;

    /** Food the player pays to execute. Automatic events never pay. */
    @Column(name = "cost_food")
    private Integer costFood;

    /** Magic the player pays to execute. Automatic events never pay. */
    @Column(name = "cost_magic")
    private Integer costMagic;

    /** CONDITION: registry key that must currently hold {@link #registryValueCondition}. */
    @Column(name = "registry_key_condition")
    private String registryKeyCondition;

    /** CONDITION: expected value of {@link #registryKeyCondition}. Null is never satisfied. */
    @Column(name = "registry_value_condition")
    private String registryValueCondition;

    /** CONDITION: the character must have this class. */
    @Column(name = "id_class_condition")
    private Integer idClassCondition;

    /** CONDITION: the character must carry this item. */
    @Column(name = "id_item_condition")
    private Integer idItemCondition;

    @PrePersist
    protected void onCreate() {
        if (type == null) type = "NORMAL";
        if (costEnery == null) costEnery = 0;
        if (flagEndTime == null) flagEndTime = 0;
        if (costCoin == null) costCoin = 0;
        if (costFood == null) costFood = 0;
        if (costMagic == null) costMagic = 0;
    }

    // === Getters & Setters ===

    public Integer getIdSpecificLocation() { return idSpecificLocation; }
    public void setIdSpecificLocation(Integer idSpecificLocation) { this.idSpecificLocation = idSpecificLocation; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Integer getCostEnery() { return costEnery; }
    public void setCostEnery(Integer costEnery) { this.costEnery = costEnery; }

    public Integer getFlagEndTime() { return flagEndTime; }
    public void setFlagEndTime(Integer flagEndTime) { this.flagEndTime = flagEndTime; }

    /** @deprecated since 0.29.0 — use {@link EventEffectEntity} item effects. */
    @Deprecated(since = "0.29.0")
    public Integer getIdItemToAdd() { return idItemToAdd; }
    /** @deprecated since 0.29.0 — use {@link EventEffectEntity} item effects. */
    @Deprecated(since = "0.29.0")
    public void setIdItemToAdd(Integer idItemToAdd) { this.idItemToAdd = idItemToAdd; }

    public Integer getIdWeather() { return idWeather; }
    public void setIdWeather(Integer idWeather) { this.idWeather = idWeather; }

    public Integer getIdEventNext() { return idEventNext; }
    public void setIdEventNext(Integer idEventNext) { this.idEventNext = idEventNext; }

    public Integer getCostCoin() { return costCoin; }
    public void setCostCoin(Integer costCoin) { this.costCoin = costCoin; }

    public Integer getCostFood() { return costFood; }
    public void setCostFood(Integer costFood) { this.costFood = costFood; }

    public Integer getCostMagic() { return costMagic; }
    public void setCostMagic(Integer costMagic) { this.costMagic = costMagic; }

    public String getRegistryKeyCondition() { return registryKeyCondition; }
    public void setRegistryKeyCondition(String registryKeyCondition) { this.registryKeyCondition = registryKeyCondition; }

    public String getRegistryValueCondition() { return registryValueCondition; }
    public void setRegistryValueCondition(String registryValueCondition) { this.registryValueCondition = registryValueCondition; }

    public Integer getIdClassCondition() { return idClassCondition; }
    public void setIdClassCondition(Integer idClassCondition) { this.idClassCondition = idClassCondition; }

    public Integer getIdItemCondition() { return idItemCondition; }
    public void setIdItemCondition(Integer idItemCondition) { this.idItemCondition = idItemCondition; }

}
