package games.paths.core.repository.story;

import games.paths.core.entity.story.StoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * StoryRepository - Spring Data JPA repository for the "list_stories" table.
 * Provides CRUD + custom query methods for story management.
 */
@Repository
public interface StoryRepository extends JpaRepository<StoryEntity, Long> {

    List<StoryEntity> findByVisibilityOrderByPriorityDesc(String visibility);

    Optional<StoryEntity> findByUuid(String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
