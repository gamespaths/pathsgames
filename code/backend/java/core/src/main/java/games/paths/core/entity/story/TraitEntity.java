package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * TraitEntity - JPA entity mapped to the "list_traits" table.
 */
@Entity
@Table(name = "list_traits")
public class TraitEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "id_class_permitted")
    private Integer idClassPermitted;

    @Column(name = "id_class_prohibited")
    private Integer idClassProhibited;

    @Column(name = "id_text_name")
    private Integer idTextName;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

    @Column(name = "cost_positive")
    private Integer costPositive;

    @Column(name = "cost_negative")
    private Integer costNegative;

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
        if (costPositive == null) costPositive = 0;
        if (costNegative == null) costNegative = 0;
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

    public Integer getIdClassPermitted() { return idClassPermitted; }
    public void setIdClassPermitted(Integer idClassPermitted) { this.idClassPermitted = idClassPermitted; }

    public Integer getIdClassProhibited() { return idClassProhibited; }
    public void setIdClassProhibited(Integer idClassProhibited) { this.idClassProhibited = idClassProhibited; }

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

    public Integer getCostPositive() { return costPositive; }
    public void setCostPositive(Integer costPositive) { this.costPositive = costPositive; }

    public Integer getCostNegative() { return costNegative; }
    public void setCostNegative(Integer costNegative) { this.costNegative = costNegative; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
