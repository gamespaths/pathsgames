package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ClassEntity - JPA entity mapped to the "list_classes" table.
 */
@Entity
@Table(name = "list_classes")
@IdClass(StoryScopedEntityId.class)
public class ClassEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    @Column(name = "weight_max", nullable = false)
    private Integer weightMax;

    @Column(name = "dexterity_base", nullable = false)
    private Integer dexterityBase;

    @Column(name = "intelligence_base", nullable = false)
    private Integer intelligenceBase;

    @Column(name = "constitution_base", nullable = false)
    private Integer constitutionBase;

    @PrePersist
    protected void onCreate() {
        if (weightMax == null) weightMax = 10;
        if (dexterityBase == null) dexterityBase = 1;
        if (intelligenceBase == null) intelligenceBase = 1;
        if (constitutionBase == null) constitutionBase = 1;
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





    public Integer getWeightMax() { return weightMax; }
    public void setWeightMax(Integer weightMax) { this.weightMax = weightMax; }

    public Integer getDexterityBase() { return dexterityBase; }
    public void setDexterityBase(Integer dexterityBase) { this.dexterityBase = dexterityBase; }

    public Integer getIntelligenceBase() { return intelligenceBase; }
    public void setIntelligenceBase(Integer intelligenceBase) { this.intelligenceBase = intelligenceBase; }

    public Integer getConstitutionBase() { return constitutionBase; }
    public void setConstitutionBase(Integer constitutionBase) { this.constitutionBase = constitutionBase; }

}
