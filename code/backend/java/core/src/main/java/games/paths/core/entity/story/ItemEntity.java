package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ItemEntity - JPA entity mapped to the "list_items" table.
 */
@Entity
@Table(name = "list_items")
@IdClass(StoryScopedEntityId.class)
public class ItemEntity extends BaseStoryScopedEntity {

    @Column(nullable = false)
    private Integer weight;

    @Column(name = "is_consumabile", nullable = false)
    private Integer isConsumabile;

    /**
     * v0.35.0 - may the board show what this item does BEFORE it is used?
     *
     * <p>1 or null report the {@code effects[]} promise, 0 keeps the secret. Nullable on
     * purpose: the column lands on stories authored before it existed, and those already
     * ship the promise - defaulting to hidden would take a feature away from all of them.
     * It gates the promise only; using the item applies exactly the same effects.</p>
     */
    @Column(name = "flag_show_effects")
    private Integer flagShowEffects;

    /**
     * v0.35.1 - how many units of this item ONE character may hold. An ADD that would
     * cross it is refused, without an error: the event still runs and everything else it
     * does still applies. 0 or null mean no limit, the same reading the class gates have.
     */
    @Column(name = "max_per_character")
    private Integer maxPerCharacter;

    /**
     * v0.35.1 - units removed by one drop-item; null reads as 1. Holding fewer is not a
     * refusal: a player putting something down can always put down everything they hold.
     */
    @Column(name = "amount_drop")
    private Integer amountDrop;

    /**
     * v0.35.1 - units consumed by one use-item; null reads as 1. Holding fewer IS a refusal
     * ({@code ITEM_NOT_ENOUGH}): drinking less than the recipe asks for would make the
     * effect a lie about what happened.
     */
    @Column(name = "amount_use")
    private Integer amountUse;

    @Column(name = "id_class_permitted")
    private Integer idClassPermitted;

    @Column(name = "id_class_prohibited")
    private Integer idClassProhibited;

    @PrePersist
    protected void onCreate() {
        if (weight == null) weight = 1;
        if (isConsumabile == null) isConsumabile = 1;
    }

    // === Getters & Setters ===

    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }

    public Integer getIsConsumabile() { return isConsumabile; }
    public void setIsConsumabile(Integer isConsumabile) { this.isConsumabile = isConsumabile; }

    public Integer getFlagShowEffects() { return flagShowEffects; }
    public void setFlagShowEffects(Integer flagShowEffects) { this.flagShowEffects = flagShowEffects; }

    public Integer getMaxPerCharacter() { return maxPerCharacter; }
    public void setMaxPerCharacter(Integer maxPerCharacter) { this.maxPerCharacter = maxPerCharacter; }

    public Integer getAmountDrop() { return amountDrop; }
    public void setAmountDrop(Integer amountDrop) { this.amountDrop = amountDrop; }

    public Integer getAmountUse() { return amountUse; }
    public void setAmountUse(Integer amountUse) { this.amountUse = amountUse; }

    public Integer getIdClassPermitted() { return idClassPermitted; }
    public void setIdClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; }

    public Integer getIdClassProhibited() { return idClassProhibited; }
    public void setIdClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; }

}
