package games.paths.core.repository.story;

import games.paths.core.entity.story.TraitEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * TraitRepository - Spring Data JPA repository for the "list_traits" table.
 * Provides CRUD + custom query methods for trait management.
 */
@Repository
public interface TraitRepository extends JpaRepository<TraitEntity, StoryScopedEntityId> {

    List<TraitEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<TraitEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
