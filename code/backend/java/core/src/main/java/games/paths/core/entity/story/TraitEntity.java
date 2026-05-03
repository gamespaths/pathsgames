package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * TraitEntity - JPA entity mapped to the "list_traits" table.
 */
@Entity
@Table(name = "list_traits")
@IdClass(StoryScopedEntityId.class)
public class TraitEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    @Column(name = "id_class_permitted")
    private Integer idClassPermitted;

    @Column(name = "id_class_prohibited")
    private Integer idClassProhibited;

    @Column(name = "cost_positive")
    private Integer costPositive;

    @Column(name = "cost_negative")
    private Integer costNegative;

    @PrePersist
    protected void onCreate() {
        if (costPositive == null) costPositive = 0;
        if (costNegative == null) costNegative = 0;
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @Override
    public Long getIdStory() { return super.getIdStory(); }

    @Override
    public void setIdStory(Long idStory) {
        super.setIdStory(idStory);
        this.idStoryPk = idStory;
    }



    public Integer getIdClassPermitted() { return idClassPermitted; }
    public void setIdClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; }

    public Integer getIdClassProhibited() { return idClassProhibited; }
    public void setIdClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; }



    public Integer getCostPositive() { return costPositive; }
    public void setCostPositive(Integer costPositive) { this.costPositive = costPositive; }

    public Integer getCostNegative() { return costNegative; }
    public void setCostNegative(Integer costNegative) { this.costNegative = costNegative; }

}
