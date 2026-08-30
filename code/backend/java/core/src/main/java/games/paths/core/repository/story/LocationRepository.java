package games.paths.core.repository.story;

import games.paths.core.entity.story.LocationEntity;
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
 * LocationRepository - Spring Data JPA repository for the "list_locations" table.
 * Provides CRUD + custom query methods for location management.
 */
@Repository
public interface LocationRepository extends JpaRepository<LocationEntity, StoryScopedEntityId> {

    List<LocationEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<LocationEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);

    /**
     * v0.35.8 — clears the five trigger columns before the story's events are deleted.
     * The events go first, and a location still naming one blocks their delete.
     */
    @Modifying
    @Transactional
    @Query("update LocationEntity l set l.idEventIfCounterZero = null,"
            + " l.idEventIfCharacterStartTime = null,"
            + " l.idEventIfCharacterEnterEmptyLocation = null,"
            + " l.idEventIfFirstTime = null, l.idEventNotFirstTime = null"
            + " where l.idStory = :idStory")
    void clearLocationTriggerEvents(@Param("idStory") Long idStory);
}
