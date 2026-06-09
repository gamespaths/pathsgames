package games.paths.core.entity.match;

/**
 * Composite primary key for {@link GamingCharacterInstanceEntity}.
 * Step 21: {@code (id, id_match)} — one character row per match, id assigned
 * per match starting at 1. See {@link AbstractMatchScopedEntityId}.
 */
public class GamingCharacterInstanceEntityId extends AbstractMatchScopedEntityId {

    public GamingCharacterInstanceEntityId() {
        super();
    }

    public GamingCharacterInstanceEntityId(Long id, Long idMatch) {
        super(id, idMatch);
    }
}
