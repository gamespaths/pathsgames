package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * StoryDifficultyEntity - JPA entity mapped to the "list_stories_difficulty" table.
 * Schema defined by Flyway migration V0.10.2.
 */
@Entity
@Table(name = "list_stories_difficulty")
public class StoryDifficultyEntity extends BaseStoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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

    @PrePersist
    protected void onCreate() {
        if (expCost == null) expCost = 5;
        if (maxWeight == null) maxWeight = 10;
        if (minCharacter == null) minCharacter = 1;
        if (maxCharacter == null) maxCharacter = 4;
        if (costHelpComa == null) costHelpComa = 3;
        if (costMaxCharacteristics == null) costMaxCharacteristics = 3;
        if (numberMaxFreeAction == null) numberMaxFreeAction = 1;
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }




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

}
