package games.paths.core.repository.story;

import games.paths.core.entity.story.EventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * EventRepository - Spring Data JPA repository for the "list_events" table.
 * Provides CRUD + custom query methods for event management.
 */
@Repository
public interface EventRepository extends JpaRepository<EventEntity, Long> {

    List<EventEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<EventEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
