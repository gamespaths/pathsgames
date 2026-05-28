package games.paths.core.repository.story;

import games.paths.core.entity.story.CreatorEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * CreatorRepository - Spring Data JPA repository for the "list_creator" table.
 * Provides CRUD + custom query methods for creator management.
 *
 * <p>Enhanced in Step 16 with creator lookup by story and UUID.</p>
 */
@Repository
public interface CreatorRepository extends JpaRepository<CreatorEntity, StoryScopedEntityId> {

    List<CreatorEntity> findByIdStory(Long idStory);

    Optional<CreatorEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
