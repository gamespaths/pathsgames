package games.paths.core.repository.story;

import games.paths.core.entity.story.StoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * StoryRepository - Spring Data JPA repository for the "list_stories" table.
 * Provides CRUD + custom query methods for story management.
 *
 * <p>Enhanced in Step 15 with category/group listing and filtering queries.</p>
 */
@Repository
public interface StoryRepository extends JpaRepository<StoryEntity, Long> {

    List<StoryEntity> findByVisibilityOrderByPriorityDesc(String visibility);

    Optional<StoryEntity> findByUuid(String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);

    // === Step 15: Category and Group queries ===

    @Query("SELECT DISTINCT s.category FROM StoryEntity s WHERE s.visibility = ?1 AND s.category IS NOT NULL ORDER BY s.category")
    List<String> findDistinctCategoriesByVisibility(String visibility);

    @Query("SELECT DISTINCT s.group FROM StoryEntity s WHERE s.visibility = ?1 AND s.group IS NOT NULL ORDER BY s.group")
    List<String> findDistinctGroupsByVisibility(String visibility);

    List<StoryEntity> findByCategoryAndVisibilityOrderByPriorityDesc(String category, String visibility);

    List<StoryEntity> findByGroupAndVisibilityOrderByPriorityDesc(String group, String visibility);
}
