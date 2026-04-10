package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ChoiceEffectEntity - JPA entity mapped to the "list_choices_effects" table.
 */
@Entity
@Table(name = "list_choices_effects")
public class ChoiceEffectEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_story", nullable = false)
    private Long idStory;

    @Column(name = "id_choices", nullable = false)
    private Integer idChoices;

    @Column(name = "id_scelta")
    private Integer idScelta;

    @Column(name = "flag_group", nullable = false)
    private Integer flagGroup;

    private String statistics;

    private Integer value;

    @Column(name = "id_text")
    private Integer idText;

    @Column(name = "\"key\"")
    private String key;

    @Column(name = "value_to_add")
    private String valueToAdd;

    @Column(name = "value_to_remove")
    private String valueToRemove;

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
        if (flagGroup == null) flagGroup = 0;
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

    public Long getIdStory() { return idStory; }
    public void setIdStory(Long idStory) { this.idStory = idStory; }

    public Integer getIdChoices() { return idChoices; }
    public void setIdChoices(Integer idChoices) { this.idChoices = idChoices; }

    public Integer getIdScelta() { return idScelta; }
    public void setIdScelta(Integer idScelta) { this.idScelta = idScelta; }

    public Integer getFlagGroup() { return flagGroup; }
    public void setFlagGroup(Integer flagGroup) { this.flagGroup = flagGroup; }

    public String getStatistics() { return statistics; }
    public void setStatistics(String statistics) { this.statistics = statistics; }

    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }

    public Integer getIdText() { return idText; }
    public void setIdText(Integer idText) { this.idText = idText; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getValueToAdd() { return valueToAdd; }
    public void setValueToAdd(String valueToAdd) { this.valueToAdd = valueToAdd; }

    public String getValueToRemove() { return valueToRemove; }
    public void setValueToRemove(String valueToRemove) { this.valueToRemove = valueToRemove; }

    public String getTsInsert() { return tsInsert; }
    public String getTsUpdate() { return tsUpdate; }
}
