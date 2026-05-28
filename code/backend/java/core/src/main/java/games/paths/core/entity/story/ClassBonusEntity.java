package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * ClassBonusEntity - JPA entity mapped to the "list_classes_bonus" table.
 */
@Entity
@Table(name = "list_classes_bonus")
@IdClass(StoryScopedEntityId.class)
public class ClassBonusEntity extends BaseStoryScopedEntity {

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

    public Integer getIdClass() { return idClass; }
    public void setIdClass(Integer idClass) { this.idClass = idClass; }

    public String getStatistic() { return statistic; }
    public void setStatistic(String statistic) { this.statistic = statistic; }

    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }

}
