package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * MissionStepEntity - JPA entity mapped to the "list_missions_steps" table.
 */
@Entity
@Table(name = "list_missions_steps")
@IdClass(StoryScopedEntityId.class)
public class MissionStepEntity extends BaseMissionEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    @Column(name = "id_mission", nullable = false)
    private Integer idMission;

    @Column(nullable = false)
    private Integer step;

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

    public Integer getIdMission() { return idMission; }
    public void setIdMission(Integer idMission) { this.idMission = idMission; }

    public Integer getStep() { return step; }
    public void setStep(Integer step) { this.step = step; }
}
