package games.paths.core.entity.story;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;

/**
 * BaseStoryScopedEntity - intermediate mapped superclass for entities whose
 * primary key is the composite {@code (id, id_story)} pair represented by
 * {@link StoryScopedEntityId}.
 *
 * <p>Centralises the two {@code @Id} columns and the {@code setIdStory}
 * override that keeps the {@code idStoryPk} mirror in sync with the
 * {@code idStory} field declared on {@link BaseStoryEntity}. Adopting this
 * superclass removes ~10 duplicated lines per concrete entity (the table-id
 * field, the id-story PK field, the getter/setter pair and the
 * {@code setIdStory} override).</p>
 *
 * <p>Subclasses still declare {@code @IdClass(StoryScopedEntityId.class)}
 * themselves so Hibernate can locate the composite-key class.</p>
 */
@MappedSuperclass
public abstract class BaseStoryScopedEntity extends BaseStoryEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_story", insertable = false, updatable = false)
    private Long idStoryPk;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @Override
    public void setIdStory(Long idStory) {
        super.setIdStory(idStory);
        this.idStoryPk = idStory;
    }
}
