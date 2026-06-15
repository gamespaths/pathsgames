package games.paths.core.entity.match;

/**
 * Composite primary key for {@link GamingInventoryItemsEntity}.
 * Step 27: {@code (id, id_match)}. See {@link AbstractMatchScopedEntityId}.
 */
public class GamingInventoryItemsEntityId extends AbstractMatchScopedEntityId {

    public GamingInventoryItemsEntityId() {
        super();
    }

    public GamingInventoryItemsEntityId(Long id, Long idMatch) {
        super(id, idMatch);
    }
}
