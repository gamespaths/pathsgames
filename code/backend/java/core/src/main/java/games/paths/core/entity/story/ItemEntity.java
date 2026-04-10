package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ItemEntity - JPA entity mapped to the "list_items" table.
 */
@Entity
@Table(name = "list_items")
public class ItemEntity extends BaseStoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer weight;

    @Column(name = "is_consumabile", nullable = false)
    private Integer isConsumabile;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }





    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }

    public Integer getIsConsumabile() { return isConsumabile; }
    public void setIsConsumabile(Integer isConsumabile) { this.isConsumabile = isConsumabile; }

    public Integer getIdClassPermitted() { return idClassPermitted; }
    public void setIdClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; }

    public Integer getIdClassProhibited() { return idClassProhibited; }
    public void setIdClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; }

}
