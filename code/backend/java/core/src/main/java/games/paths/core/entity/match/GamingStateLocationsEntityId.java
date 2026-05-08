package games.paths.core.entity.match;

import java.io.Serializable;
import java.util.Objects;

/**
 * Composite primary key for {@link GamingStateLocationsEntity}.
 * Step 19: Initialised at match creation, one row per (match, location).
 */
public class GamingStateLocationsEntityId implements Serializable {

    private Long idMatch;
    private Long idLocation;

    public GamingStateLocationsEntityId() {
    }

    public GamingStateLocationsEntityId(Long idMatch, Long idLocation) {
        this.idMatch = idMatch;
        this.idLocation = idLocation;
    }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    public Long getIdLocation() { return idLocation; }
    public void setIdLocation(Long idLocation) { this.idLocation = idLocation; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof GamingStateLocationsEntityId that)) return false;
        return Objects.equals(idMatch, that.idMatch) && Objects.equals(idLocation, that.idLocation);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idMatch, idLocation);
    }
}
