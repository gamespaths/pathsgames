package games.paths.core.entity.match;

import java.io.Serializable;
import java.util.Objects;

/**
 * Composite primary key for {@link GamingTurnQueueEntity}: {@code (id_match, id_character_match)}.
 * Step 24.
 */
public class GamingTurnQueueEntityId implements Serializable {

    private Long idMatch;
    private Long idCharacterMatch;

    public GamingTurnQueueEntityId() {
    }

    public GamingTurnQueueEntityId(Long idMatch, Long idCharacterMatch) {
        this.idMatch = idMatch;
        this.idCharacterMatch = idCharacterMatch;
    }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    public Long getIdCharacterMatch() { return idCharacterMatch; }
    public void setIdCharacterMatch(Long idCharacterMatch) { this.idCharacterMatch = idCharacterMatch; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof GamingTurnQueueEntityId that)) return false;
        return Objects.equals(idMatch, that.idMatch)
                && Objects.equals(idCharacterMatch, that.idCharacterMatch);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idMatch, idCharacterMatch);
    }
}
