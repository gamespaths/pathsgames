package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ItemEntity - JPA entity mapped to the "list_items" table.
 */
@Entity
@Table(name = "list_items")
public class ItemEntity {

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

    @Column(nullable = false)
    private Integer weight;

    @Column(name = "is_consumabile", nullable = false)
    private Integer isConsumabile;

    @Column(name = "id_class_permitted")
    private Integer idClassPermitted;

    @Column(name = "id_class_prohibited")
    private Integer idClassProhibited;

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
        if (weight == null) weight = 1;
        if (isConsumabile == null) isConsumabile = 1;
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

    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }

    public Integer getIsConsumabile() { return isConsumabile; }
    public void setIsConsumabile(Integer isConsumabile) { this.isConsumabile = isConsumabile; }

    public Integer getIdClassPermitted() { return idClassPermitted; }
    public void setIdClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; }

    public Integer getIdClassProhibited() { return idClassProhibited; }
    public void setIdClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
