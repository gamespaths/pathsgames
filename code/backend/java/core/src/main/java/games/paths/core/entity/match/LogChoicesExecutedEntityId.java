package games.paths.core.entity.match;

/**
 * Composite primary key {@code (id, id_match)} for {@link LogChoicesExecutedEntity}.
 */
public class LogChoicesExecutedEntityId extends AbstractMatchScopedEntityId {

    public LogChoicesExecutedEntityId() {
        super();
    }

    public LogChoicesExecutedEntityId(Long id, Long idMatch) {
        super(id, idMatch);
    }
}
