package games.paths.core.repository.story;

import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * EventRepository - Spring Data JPA repository for the "list_events" table.
 * Provides CRUD + custom query methods for event management.
 */
@Repository
public interface EventRepository extends JpaRepository<EventEntity, StoryScopedEntityId> {

    List<EventEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<EventEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);

    /**
     * v0.35.8 — clears the chain BEFORE the story's events are deleted. id_event_next
     * points into this very table, so deleting the chained-to event while the chaining one
     * still names it is a foreign-key violation on PostgreSQL.
     */
    @Modifying
    @Transactional
    @Query("update EventEntity e set e.idEventNext = null where e.idStory = :idStory")
    void clearEventChains(@Param("idStory") Long idStory);
}
