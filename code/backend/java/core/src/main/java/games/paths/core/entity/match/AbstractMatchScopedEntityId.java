package games.paths.core.entity.match;

import java.io.Serializable;
import java.util.Objects;

/**
 * Shared base for the {@code (id, id_match)} composite primary keys of the
 * match-scoped gaming entities (Step 21).
 *
 * <p>v0.20.9 — extracted from the per-entity {@code *EntityId} classes to remove
 * the duplicated key boilerplate flagged by SonarQube. {@link #equals(Object)}
 * uses {@code getClass()} so keys of different entity types are never equal,
 * preserving the original per-type {@code instanceof} semantics.</p>
 */
public abstract class AbstractMatchScopedEntityId implements Serializable {

    private Long id;
    private Long idMatch;

    protected AbstractMatchScopedEntityId() {
    }

    protected AbstractMatchScopedEntityId(Long id, Long idMatch) {
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
        if (o == null || getClass() != o.getClass()) return false;
        AbstractMatchScopedEntityId that = (AbstractMatchScopedEntityId) o;
        return Objects.equals(id, that.id) && Objects.equals(idMatch, that.idMatch);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, idMatch);
    }
}
