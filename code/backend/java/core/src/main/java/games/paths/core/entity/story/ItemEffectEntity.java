package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ItemEffectEntity - JPA entity mapped to the "list_items_effects" table.
 */
@Entity
@Table(name = "list_items_effects")
public class ItemEffectEntity extends BaseStoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_item", nullable = false)
    private Integer idItem;

    @Column(name = "effect_code", nullable = false)
    private String effectCode;

    @Column(name = "effect_value", nullable = false)
    private Integer effectValue;

    @PrePersist
    protected void onCreate() {
        if (effectValue == null) effectValue = 0;
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }


    public Integer getIdItem() { return idItem; }
    public void setIdItem(Integer idItem) { this.idItem = idItem; }



    public String getEffectCode() { return effectCode; }
    public void setEffectCode(String effectCode) { this.effectCode = effectCode; }

    public Integer getEffectValue() { return effectValue; }
    public void setEffectValue(Integer effectValue) { this.effectValue = effectValue; }

}
