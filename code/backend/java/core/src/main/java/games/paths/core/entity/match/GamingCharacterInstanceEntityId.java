package games.paths.core.entity.match;

import java.io.Serializable;
import java.util.Objects;

/**
 * Composite primary key for {@link GamingCharacterInstanceEntity}.
 * Step 21: {@code (id, id_match)} — one character row per match, id assigned
 * per match starting at 1.
 */
public class GamingCharacterInstanceEntityId implements Serializable {

    private Long id;
    private Long idMatch;

    public GamingCharacterInstanceEntityId() {
    }

    public GamingCharacterInstanceEntityId(Long id, Long idMatch) {
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
        if (!(o instanceof GamingCharacterInstanceEntityId that)) return false;
        return Objects.equals(id, that.id) && Objects.equals(idMatch, that.idMatch);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, idMatch);
    }
}
