package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ChoiceEffectEntity - JPA entity mapped to the "list_choices_effects" table.
 */
@Entity
@Table(name = "list_choices_effects")
@IdClass(StoryScopedEntityId.class)
public class ChoiceEffectEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

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

    @PrePersist
    protected void onCreate() {
        if (flagGroup == null) flagGroup = 0;
        if (value == null) value = 0;
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

}
