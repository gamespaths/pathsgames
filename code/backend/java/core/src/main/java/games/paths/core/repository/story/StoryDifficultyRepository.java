package games.paths.core.repository.story;

import games.paths.core.entity.story.StoryDifficultyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * StoryDifficultyRepository - Spring Data JPA repository for the "list_stories_difficulty" table.
 * Provides CRUD + custom query methods for story difficulty management.
 */
@Repository
public interface StoryDifficultyRepository extends JpaRepository<StoryDifficultyEntity, Long> {

    List<StoryDifficultyEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<StoryDifficultyEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
