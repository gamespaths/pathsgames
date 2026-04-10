package games.paths.core.repository.story;

import games.paths.core.entity.story.ClassBonusEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * ClassBonusRepository - Spring Data JPA repository for the "list_classes_bonus" table.
 * Provides CRUD + custom query methods for class bonus management.
 */
@Repository
public interface ClassBonusRepository extends JpaRepository<ClassBonusEntity, Long> {

    List<ClassBonusEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
