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

    /**
     * v0.35.2 - 1 hides the trait from the start-match picker and refuses it if selected
     * anyway; 0 or null leave it pickable, which is what every trait authored before this
     * column was. It never blocks OWNING the trait: an event or item effect may still grant
     * it through {@code traits_to_add}, and that is the whole point of the flag.
     */
    @Column(name = "hide_on_start_match")
    private Integer hideOnStartMatch;

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

    public Integer getHideOnStartMatch() { return hideOnStartMatch; }
    public void setHideOnStartMatch(Integer hideOnStartMatch) { this.hideOnStartMatch = hideOnStartMatch; }

    /** v0.35.2 - only an explicit 1 hides it; null is the reading of a pre-0.35.2 story. */
    public boolean isHiddenOnStartMatch() {
        return hideOnStartMatch != null && hideOnStartMatch == 1;
    }
}
