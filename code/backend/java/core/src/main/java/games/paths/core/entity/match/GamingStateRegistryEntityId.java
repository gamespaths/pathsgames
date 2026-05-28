package games.paths.core.entity.match;

import java.io.Serializable;
import java.util.Objects;

/**
 * Composite primary key for {@link GamingStateRegistryEntity}.
 * Step 19: Initialised at match creation, one row per default story key.
 */
public class GamingStateRegistryEntityId implements Serializable {

    private Long id;
    private Long idMatch;

    public GamingStateRegistryEntityId() {
    }

    public GamingStateRegistryEntityId(Long id, Long idMatch) {
        this.id = id;
        this.idMatch = idMatch;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof GamingStateRegistryEntityId that)) return false;
        return Objects.equals(id, that.id) && Objects.equals(idMatch, that.idMatch);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, idMatch);
    }
}
