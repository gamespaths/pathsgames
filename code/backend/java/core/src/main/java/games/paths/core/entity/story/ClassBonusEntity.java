package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ClassBonusEntity - JPA entity mapped to the "list_classes_bonus" table.
 */
@Entity
@Table(name = "list_classes_bonus")
@IdClass(StoryScopedEntityId.class)
public class ClassBonusEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    @Column(name = "id_class", nullable = false)
    private Integer idClass;

    @Column(nullable = false)
    private String statistic;

    @Column(nullable = false)
    private Integer value;

    @PrePersist
    protected void onCreate() {
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



    public Integer getIdClass() { return idClass; }
    public void setIdClass(Integer idClass) { this.idClass = idClass; }

    public String getStatistic() { return statistic; }
    public void setStatistic(String statistic) { this.statistic = statistic; }

    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }



}
