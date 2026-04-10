package games.paths.core.repository.story;

import games.paths.core.entity.story.LocationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * LocationRepository - Spring Data JPA repository for the "list_locations" table.
 * Provides CRUD + custom query methods for location management.
 */
@Repository
public interface LocationRepository extends JpaRepository<LocationEntity, Long> {

    List<LocationEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
