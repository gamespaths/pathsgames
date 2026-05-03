package games.paths.core.repository.story;

import games.paths.core.entity.story.MissionEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * MissionRepository - Spring Data JPA repository for the "list_missions" table.
 * Provides CRUD + custom query methods for mission management.
 */
@Repository
public interface MissionRepository extends JpaRepository<MissionEntity, StoryScopedEntityId> {

    List<MissionEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<MissionEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
