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

    @Column(name = "life", nullable = false)
    private Integer life;

    @Column(name = "energy", nullable = false)
    private Integer energy;

    @Column(name = "sad", nullable = false)
    private Integer sad;

    @Column(name = "dexterity", nullable = false)
    private Integer dexterity;

    @Column(name = "intelligence", nullable = false)
    private Integer intelligence;

    @Column(name = "constitution", nullable = false)
    private Integer constitution;

    @Column(name = "weight", nullable = false)
    private Integer weight;

    @PrePersist
    protected void onCreate() {
        if (costPositive == null) costPositive = 0;
        if (costNegative == null) costNegative = 0;
        if (life == null) life = 0;
        if (energy == null) energy = 0;
        if (sad == null) sad = 0;
        if (dexterity == null) dexterity = 0;
        if (intelligence == null) intelligence = 0;
        if (constitution == null) constitution = 0;
        if (weight == null) weight = 0;
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

    public Integer getLife() { return life; }
    public void setLife(Integer life) { this.life = life; }

    public Integer getEnergy() { return energy; }
    public void setEnergy(Integer energy) { this.energy = energy; }

    public Integer getSad() { return sad; }
    public void setSad(Integer sad) { this.sad = sad; }

    public Integer getDexterity() { return dexterity; }
    public void setDexterity(Integer dexterity) { this.dexterity = dexterity; }

    public Integer getIntelligence() { return intelligence; }
    public void setIntelligence(Integer intelligence) { this.intelligence = intelligence; }

    public Integer getConstitution() { return constitution; }
    public void setConstitution(Integer constitution) { this.constitution = constitution; }

    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }

}
