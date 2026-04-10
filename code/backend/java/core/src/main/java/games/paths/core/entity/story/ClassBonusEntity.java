package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ClassBonusEntity - JPA entity mapped to the "list_classes_bonus" table.
 */
@Entity
@Table(name = "list_classes_bonus")
public class ClassBonusEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "id_class", nullable = false)
    private Integer idClass;

    @Column(nullable = false)
    private String statistic;

    @Column(nullable = false)
    private Integer value;

    @Column(name = "id_text_name")
    private Integer idTextName;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

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
        if (value == null) value = 0;
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

    public Integer getIdClass() { return idClass; }
    public void setIdClass(Integer idClass) { this.idClass = idClass; }

    public String getStatistic() { return statistic; }
    public void setStatistic(String statistic) { this.statistic = statistic; }

    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
