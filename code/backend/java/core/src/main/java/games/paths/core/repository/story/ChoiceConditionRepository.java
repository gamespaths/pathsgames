package games.paths.core.repository.story;

import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * ChoiceConditionRepository - Spring Data JPA repository for the "list_choices_conditions" table.
 * Provides CRUD + custom query methods for choice condition management.
 */
@Repository
public interface ChoiceConditionRepository extends JpaRepository<ChoiceConditionEntity, StoryScopedEntityId> {

    List<ChoiceConditionEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<ChoiceConditionEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
