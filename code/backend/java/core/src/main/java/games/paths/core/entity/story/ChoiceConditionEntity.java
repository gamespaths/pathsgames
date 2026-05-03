package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ChoiceConditionEntity - JPA entity mapped to the "list_choices_conditions" table.
 */
@Entity
@Table(name = "list_choices_conditions")
@IdClass(StoryScopedEntityId.class)
public class ChoiceConditionEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    @Column(name = "id_choices", nullable = false)
    private Integer idChoices;

    @Column(nullable = false)
    private String type;

    @Column(name = "\"key\"")
    private String key;

    @Column(name = "\"value\"")
    private String value;

    private String operator;

    @PrePersist
    protected void onCreate() {
        if (operator == null) operator = "=";
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

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }



}
