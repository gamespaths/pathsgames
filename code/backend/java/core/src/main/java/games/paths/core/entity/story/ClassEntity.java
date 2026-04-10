package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ClassEntity - JPA entity mapped to the "list_classes" table.
 */
@Entity
@Table(name = "list_classes")
public class ClassEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "id_text_name")
    private Integer idTextName;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

    @Column(name = "weight_max", nullable = false)
    private Integer weightMax;

    @Column(name = "dexterity_base", nullable = false)
    private Integer dexterityBase;

    @Column(name = "intelligence_base", nullable = false)
    private Integer intelligenceBase;

    @Column(name = "constitution_base", nullable = false)
    private Integer constitutionBase;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
        if (weightMax == null) weightMax = 10;
        if (dexterityBase == null) dexterityBase = 1;
        if (intelligenceBase == null) intelligenceBase = 1;
        if (constitutionBase == null) constitutionBase = 1;
    }

    @PreUpdate
    protected void onUpdate() {
        tsUpdate = java.time.Instant.now().toString();
    }

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public Long getIdStory() { return idStory; }
    public void setIdStory(Long idStory) { this.idStory = idStory; }

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

    public Integer getWeightMax() { return weightMax; }
    public void setWeightMax(Integer weightMax) { this.weightMax = weightMax; }

    public Integer getDexterityBase() { return dexterityBase; }
    public void setDexterityBase(Integer dexterityBase) { this.dexterityBase = dexterityBase; }

    public Integer getIntelligenceBase() { return intelligenceBase; }
    public void setIntelligenceBase(Integer intelligenceBase) { this.intelligenceBase = intelligenceBase; }

    public Integer getConstitutionBase() { return constitutionBase; }
    public void setConstitutionBase(Integer constitutionBase) { this.constitutionBase = constitutionBase; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
