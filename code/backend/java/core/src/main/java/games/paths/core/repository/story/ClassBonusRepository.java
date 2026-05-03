package games.paths.core.repository.story;

import games.paths.core.entity.story.ClassBonusEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * ClassBonusRepository - Spring Data JPA repository for the "list_classes_bonus" table.
 * Provides CRUD + custom query methods for class bonus management.
 */
@Repository
public interface ClassBonusRepository extends JpaRepository<ClassBonusEntity, StoryScopedEntityId> {

    List<ClassBonusEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<ClassBonusEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
