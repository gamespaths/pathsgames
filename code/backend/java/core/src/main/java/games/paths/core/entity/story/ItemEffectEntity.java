package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ItemEffectEntity - JPA entity mapped to the "list_items_effects" table.
 */
@Entity
@Table(name = "list_items_effects")
@IdClass(StoryScopedEntityId.class)
public class ItemEffectEntity extends BaseStoryScopedEntity {

    @Column(name = "id_item", nullable = false)
    private Integer idItem;

    @Column(name = "effect_code", nullable = false)
    private String effectCode;

    @Column(name = "effect_value", nullable = false)
    private Integer effectValue;

    /** v0.34.0 - CSV of story-scoped trait ids, same format as list_events_effects. */
    @Column(name = "traits_to_add")
    private String traitsToAdd;

    /** v0.34.0 - CSV of story-scoped trait ids, same format as list_events_effects. */
    @Column(name = "traits_to_remove")
    private String traitsToRemove;

    @PrePersist
    protected void onCreate() {
        if (effectValue == null) effectValue = 0;
    }

    // === Getters & Setters ===

    public Integer getIdItem() { return idItem; }
    public void setIdItem(Integer idItem) { this.idItem = idItem; }

    public String getEffectCode() { return effectCode; }
    public void setEffectCode(String effectCode) { this.effectCode = effectCode; }

    public Integer getEffectValue() { return effectValue; }
    public void setEffectValue(Integer effectValue) { this.effectValue = effectValue; }

    public String getTraitsToAdd() { return traitsToAdd; }
    public void setTraitsToAdd(String traitsToAdd) { this.traitsToAdd = traitsToAdd; }

    public String getTraitsToRemove() { return traitsToRemove; }
    public void setTraitsToRemove(String traitsToRemove) { this.traitsToRemove = traitsToRemove; }

}
