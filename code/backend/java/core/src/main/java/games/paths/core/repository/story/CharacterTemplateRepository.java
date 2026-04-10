package games.paths.core.repository.story;

import games.paths.core.entity.story.CharacterTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * CharacterTemplateRepository - Spring Data JPA repository for the "list_character_templates" table.
 * Provides CRUD + custom query methods for character template management.
 */
@Repository
public interface CharacterTemplateRepository extends JpaRepository<CharacterTemplateEntity, Long> {

    List<CharacterTemplateEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
