package games.paths.core.repository.story;

import games.paths.core.entity.story.ChoiceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * ChoiceRepository - Spring Data JPA repository for the "list_choices" table.
 * Provides CRUD + custom query methods for choice management.
 */
@Repository
public interface ChoiceRepository extends JpaRepository<ChoiceEntity, Long> {

    List<ChoiceEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
