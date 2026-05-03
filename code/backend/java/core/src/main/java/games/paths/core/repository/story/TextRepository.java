package games.paths.core.repository.story;

import games.paths.core.entity.story.TextEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * TextRepository - Spring Data JPA repository for the "list_texts" table.
 * Provides CRUD + custom query methods for text/localization management.
 */
@Repository
public interface TextRepository extends JpaRepository<TextEntity, StoryScopedEntityId> {

    List<TextEntity> findByIdStory(Long idStory);

    List<TextEntity> findByIdStoryAndIdText(Long idStory, Integer idText);

    List<TextEntity> findByIdStoryAndIdTextAndLang(Long idStory, Integer idText, String lang);

    Optional<TextEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
