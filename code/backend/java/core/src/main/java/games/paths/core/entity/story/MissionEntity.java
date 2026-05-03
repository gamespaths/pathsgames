package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * MissionEntity - JPA entity mapped to the "list_missions" table.
 */
@Entity
@IdClass(StoryScopedEntityId.class)
@Table(name = "list_missions")
public class MissionEntity extends BaseMissionEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

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
}
