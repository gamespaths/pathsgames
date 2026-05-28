package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * TraitEntity - JPA entity mapped to the "list_traits" table.
 * Composite-PK (id, id_story) handling lives in {@link BaseStoryScopedEntity};
 * the seven stat columns live in {@link StatStoryEntity}.
 */
@Entity
@Table(name = "list_traits")
@IdClass(StoryScopedEntityId.class)
public class TraitEntity extends StatStoryEntity {

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
        initStatDefaults();
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
