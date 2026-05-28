package games.paths.core.entity.story;

import java.io.Serializable;
import java.util.Objects;

public class CharacterTemplateScopedEntityId implements Serializable {

    private Long idTipo;
    private Long idStoryPk;

    public CharacterTemplateScopedEntityId() {
    }

    public CharacterTemplateScopedEntityId(Long idTipo, Long idStoryPk) {
        this.idTipo = idTipo;
        this.idStoryPk = idStoryPk;
    }

    public Long getIdTipo() {
        return idTipo;
    }

    public void setIdTipo(Long idTipo) {
        this.idTipo = idTipo;
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
        if (!(o instanceof CharacterTemplateScopedEntityId that)) return false;
        return Objects.equals(idTipo, that.idTipo) && Objects.equals(idStoryPk, that.idStoryPk);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idTipo, idStoryPk);
    }
}
