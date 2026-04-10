package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * MissionStepEntity - JPA entity mapped to the "list_missions_steps" table.
 */
@Entity
@Table(name = "list_missions_steps")
public class MissionStepEntity extends BaseMissionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_mission", nullable = false)
    private Integer idMission;

    @Column(nullable = false)
    private Integer step;

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getIdMission() { return idMission; }
    public void setIdMission(Integer idMission) { this.idMission = idMission; }

    public Integer getStep() { return step; }
    public void setStep(Integer step) { this.step = step; }
}
