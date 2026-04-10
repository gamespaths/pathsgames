package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * CharacterTemplateEntity - JPA entity mapped to the "list_character_templates" table.
 */
@Entity
@Table(name = "list_character_templates")
public class CharacterTemplateEntity extends BaseStoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_tipo")
    private Long idTipo;

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

}
