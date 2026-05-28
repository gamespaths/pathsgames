package games.paths.core.repository.story;

import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * ClassRepository - Spring Data JPA repository for the "list_classes" table.
 * Provides CRUD + custom query methods for class management.
 */
@Repository
public interface ClassRepository extends JpaRepository<ClassEntity, StoryScopedEntityId> {

    List<ClassEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<ClassEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
