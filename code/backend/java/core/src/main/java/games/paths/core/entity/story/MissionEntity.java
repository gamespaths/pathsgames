package games.paths.core.entity.story;

import jakarta.persistence.Entity;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/**
 * MissionEntity - JPA entity mapped to the "list_missions" table.
 * Composite-PK + condition fields handled by {@link BaseMissionEntity}.
 */
@Entity
@IdClass(StoryScopedEntityId.class)
@Table(name = "list_missions")
public class MissionEntity extends BaseMissionEntity {
}
