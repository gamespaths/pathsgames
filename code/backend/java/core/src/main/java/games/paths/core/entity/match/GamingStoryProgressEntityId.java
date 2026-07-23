package games.paths.core.entity.match;

/**
 * Composite primary key {@code (id, id_match)} for {@link GamingStoryProgressEntity}.
 */
public class GamingStoryProgressEntityId extends AbstractMatchScopedEntityId {

    public GamingStoryProgressEntityId() {
        super();
    }

    public GamingStoryProgressEntityId(Long id, Long idMatch) {
        super(id, idMatch);
    }
}
