package games.paths.core.entity.match;

/**
 * Composite primary key for {@link GamingBackpackResourcesEntity}.
 * Step 21: {@code (id, id_match)}. See {@link AbstractMatchScopedEntityId}.
 */
public class GamingBackpackResourcesEntityId extends AbstractMatchScopedEntityId {

    public GamingBackpackResourcesEntityId() {
        super();
    }

    public GamingBackpackResourcesEntityId(Long id, Long idMatch) {
        super(id, idMatch);
    }
}
