package games.paths.core.repository.story;

import games.paths.core.entity.story.LocationNeighborEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * LocationNeighborRepository - Spring Data JPA repository for the "list_locations_neighbors" table.
 * Provides CRUD + custom query methods for location neighbor management.
 */
@Repository
public interface LocationNeighborRepository extends JpaRepository<LocationNeighborEntity, Long> {

    List<LocationNeighborEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<LocationNeighborEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
