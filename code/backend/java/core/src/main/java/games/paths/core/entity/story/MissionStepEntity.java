package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * MissionStepEntity - JPA entity mapped to the "list_missions_steps" table.
 * Composite-PK + condition fields handled by {@link BaseMissionEntity}.
 */
@Entity
@Table(name = "list_missions_steps")
@IdClass(StoryScopedEntityId.class)
public class MissionStepEntity extends BaseMissionEntity {

    @Column(name = "id_mission", nullable = false)
    private Integer idMission;

    @Column(nullable = false)
    private Integer step;

    public Integer getIdMission() { return idMission; }
    public void setIdMission(Integer idMission) { this.idMission = idMission; }

    public Integer getStep() { return step; }
    public void setStep(Integer step) { this.step = step; }
}
