package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ItemEffectEntity - JPA entity mapped to the "list_items_effects" table.
 */
@Entity
@Table(name = "list_items_effects")
public class ItemEffectEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "id_item", nullable = false)
    private Integer idItem;

    @Column(name = "id_text_name")
    private Integer idTextName;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

    @Column(name = "effect_code", nullable = false)
    private String effectCode;

    @Column(name = "effect_value", nullable = false)
    private Integer effectValue;

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
        if (effectValue == null) effectValue = 0;
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

    public Long getIdStory() { return idStory; }
    public void setIdStory(Long idStory) { this.idStory = idStory; }

    public Integer getIdItem() { return idItem; }
    public void setIdItem(Integer idItem) { this.idItem = idItem; }

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

    public String getEffectCode() { return effectCode; }
    public void setEffectCode(String effectCode) { this.effectCode = effectCode; }

    public Integer getEffectValue() { return effectValue; }
    public void setEffectValue(Integer effectValue) { this.effectValue = effectValue; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
