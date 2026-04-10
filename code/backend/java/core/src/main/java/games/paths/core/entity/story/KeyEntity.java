package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * KeyEntity - JPA entity mapped to the "list_keys" table.
 */
@Entity
@Table(name = "list_keys")
public class KeyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(nullable = false)
    private String name;

    private String value;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

    @Column(name = "\"group\"")
    private String group;

    private Integer priority;

    private String visibility;

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
        if (priority == null) priority = 0;
        if (visibility == null) visibility = "PUBLIC";
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

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }

    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
