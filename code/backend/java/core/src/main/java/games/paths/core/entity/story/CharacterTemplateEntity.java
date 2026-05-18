package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * CharacterTemplateEntity - JPA entity mapped to the "list_character_templates" table.
 */
@Entity
@Table(name = "list_character_templates")
@IdClass(CharacterTemplateScopedEntityId.class)
public class CharacterTemplateEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id_tipo")
    private Long idTipo;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    @Column(name = "life_max", nullable = false)
    private Integer lifeMax;

    @Column(name = "energy_max", nullable = false)
    private Integer energyMax;

    @Column(name = "sad_max", nullable = false)
    private Integer sadMax;

    @Column(name = "dexterity_start", nullable = false)
    private Integer dexterityStart;

    @Column(name = "intelligence_start", nullable = false)
    private Integer intelligenceStart;

    @Column(name = "constitution_start", nullable = false)
    private Integer constitutionStart;

    @Column(name = "id_class_permitted")
    private Integer idClassPermitted;

    @Column(name = "id_class_prohibited")
    private Integer idClassProhibited;

    @PrePersist
    protected void onCreate() {
        if (lifeMax == null) lifeMax = 10;
        if (energyMax == null) energyMax = 10;
        if (sadMax == null) sadMax = 10;
        if (dexterityStart == null) dexterityStart = 1;
        if (intelligenceStart == null) intelligenceStart = 1;
        if (constitutionStart == null) constitutionStart = 1;
    }

    // === Getters & Setters ===

    public Long getIdTipo() { return idTipo; }
    public void setIdTipo(Long idTipo) { this.idTipo = idTipo; }

    @Override
    public Long getIdStory() { return super.getIdStory(); }

    @Override
    public void setIdStory(Long idStory) {
        super.setIdStory(idStory);
        this.idStoryPk = idStory;
    }





    public Integer getLifeMax() { return lifeMax; }
    public void setLifeMax(Integer lifeMax) { this.lifeMax = lifeMax; }

    public Integer getEnergyMax() { return energyMax; }
    public void setEnergyMax(Integer energyMax) { this.energyMax = energyMax; }

    public Integer getSadMax() { return sadMax; }
    public void setSadMax(Integer sadMax) { this.sadMax = sadMax; }

    public Integer getDexterityStart() { return dexterityStart; }
    public void setDexterityStart(Integer dexterityStart) { this.dexterityStart = dexterityStart; }

    public Integer getIntelligenceStart() { return intelligenceStart; }
    public void setIntelligenceStart(Integer intelligenceStart) { this.intelligenceStart = intelligenceStart; }

    public Integer getConstitutionStart() { return constitutionStart; }
    public void setConstitutionStart(Integer constitutionStart) { this.constitutionStart = constitutionStart; }

    public Integer getIdClassPermitted() { return idClassPermitted; }
    public void setIdClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; }

    public Integer getIdClassProhibited() { return idClassProhibited; }
    public void setIdClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; }

}
