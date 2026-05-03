package games.paths.core.repository.story;

import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * EventEffectRepository - Spring Data JPA repository for the "list_events_effects" table.
 * Provides CRUD + custom query methods for event effect management.
 */
@Repository
public interface EventEffectRepository extends JpaRepository<EventEffectEntity, StoryScopedEntityId> {

    List<EventEffectEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<EventEffectEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
