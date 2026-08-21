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

    public Integer getIdClassPermitted() { return idClassPermitted; }
    public void setIdClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; }

    public Integer getIdClassProhibited() { return idClassProhibited; }
    public void setIdClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; }

}
