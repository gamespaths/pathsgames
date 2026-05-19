package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * StoryDifficultyEntity - JPA entity mapped to the "list_stories_difficulty" table.
 * Schema defined by Flyway migration V0.10.2, stat columns added in V0.19.7.
 */
@Entity
@Table(name = "list_stories_difficulty")
@AttributeOverride(name = "idStory", column = @Column(name = "id_story", insertable = false, updatable = false))
@IdClass(StoryScopedEntityId.class)
public class StoryDifficultyEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    @Column(name = "exp_cost", nullable = false)
    private Integer expCost;

    @Column(name = "max_weight", nullable = false)
    private Integer maxWeight;

    @Column(name = "min_character", nullable = false)
    private Integer minCharacter;

    @Column(name = "max_character", nullable = false)
    private Integer maxCharacter;

    @Column(name = "cost_help_coma", nullable = false)
    private Integer costHelpComa;

    @Column(name = "cost_max_characteristics", nullable = false)
    private Integer costMaxCharacteristics;

    @Column(name = "number_max_free_action", nullable = false)
    private Integer numberMaxFreeAction;

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
        if (expCost == null) expCost = 5;
        if (maxWeight == null) maxWeight = 10;
        if (minCharacter == null) minCharacter = 1;
        if (maxCharacter == null) maxCharacter = 4;
        if (costHelpComa == null) costHelpComa = 3;
        if (costMaxCharacteristics == null) costMaxCharacteristics = 3;
        if (numberMaxFreeAction == null) numberMaxFreeAction = 1;
        if (life == null) life = 100;
        if (energy == null) energy = 100;
        if (sad == null) sad = 0;
        if (dexterity == null) dexterity = 10;
        if (intelligence == null) intelligence = 10;
        if (constitution == null) constitution = 10;
        if (weight == null) weight = 10;
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




    public Integer getExpCost() { return expCost; }
    public void setExpCost(Integer expCost) { this.expCost = expCost; }

    public Integer getMaxWeight() { return maxWeight; }
    public void setMaxWeight(Integer maxWeight) { this.maxWeight = maxWeight; }

    public Integer getMinCharacter() { return minCharacter; }
    public void setMinCharacter(Integer minCharacter) { this.minCharacter = minCharacter; }

    public Integer getMaxCharacter() { return maxCharacter; }
    public void setMaxCharacter(Integer maxCharacter) { this.maxCharacter = maxCharacter; }

    public Integer getCostHelpComa() { return costHelpComa; }
    public void setCostHelpComa(Integer costHelpComa) { this.costHelpComa = costHelpComa; }

    public Integer getCostMaxCharacteristics() { return costMaxCharacteristics; }
    public void setCostMaxCharacteristics(Integer costMaxCharacteristics) { this.costMaxCharacteristics = costMaxCharacteristics; }

    public Integer getNumberMaxFreeAction() { return numberMaxFreeAction; }
    public void setNumberMaxFreeAction(Integer numberMaxFreeAction) { this.numberMaxFreeAction = numberMaxFreeAction; }

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
