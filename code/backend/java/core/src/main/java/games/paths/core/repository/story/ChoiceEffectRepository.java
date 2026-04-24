package games.paths.core.repository.story;

import games.paths.core.entity.story.ChoiceEffectEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * ChoiceEffectRepository - Spring Data JPA repository for the "list_choices_effects" table.
 * Provides CRUD + custom query methods for choice effect management.
 */
@Repository
public interface ChoiceEffectRepository extends JpaRepository<ChoiceEffectEntity, Long> {

    List<ChoiceEffectEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<ChoiceEffectEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
