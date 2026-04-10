package games.paths.core.entity.story;

import jakarta.persistence.*;

/**
 * MissionEntity - JPA entity mapped to the "list_missions" table.
 */
@Entity
@Table(name = "list_missions")
public class MissionEntity extends BaseMissionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // === Getters & Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
}
