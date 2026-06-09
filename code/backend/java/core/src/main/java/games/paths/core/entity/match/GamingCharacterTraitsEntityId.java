package games.paths.core.entity.match;

/**
 * Composite primary key for {@link GamingCharacterTraitsEntity}.
 * Step 21: {@code (id, id_match)}. See {@link AbstractMatchScopedEntityId}.
 */
public class GamingCharacterTraitsEntityId extends AbstractMatchScopedEntityId {

    public GamingCharacterTraitsEntityId() {
        super();
    }

    public GamingCharacterTraitsEntityId(Long id, Long idMatch) {
        super(id, idMatch);
    }
}
