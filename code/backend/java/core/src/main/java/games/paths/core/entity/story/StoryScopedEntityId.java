package games.paths.core.entity.story;

import java.io.Serializable;
import java.util.Objects;

public class StoryScopedEntityId implements Serializable {

    private Long id;
    private Long idStoryPk;

    public StoryScopedEntityId() {
    }

    public StoryScopedEntityId(Long id, Long idStoryPk) {
        this.id = id;
        this.idStoryPk = idStoryPk;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getIdStoryPk() {
        return idStoryPk;
    }

    public void setIdStoryPk(Long idStoryPk) {
        this.idStoryPk = idStoryPk;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof StoryScopedEntityId that)) return false;
        return Objects.equals(id, that.id) && Objects.equals(idStoryPk, that.idStoryPk);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, idStoryPk);
    }
}