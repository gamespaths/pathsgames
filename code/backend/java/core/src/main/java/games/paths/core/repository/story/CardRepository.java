package games.paths.core.repository.story;

import games.paths.core.entity.story.CardEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * CardRepository - Spring Data JPA repository for the "list_cards" table.
 * Provides CRUD + custom query methods for card management.
 *
 * <p>Enhanced in Step 15 with card lookup by story and card ID.</p>
 * <p>Enhanced in Step 16 with card lookup by story and card UUID.</p>
 */
@Repository
public interface CardRepository extends JpaRepository<CardEntity, Long> {

    List<CardEntity> findByIdStory(Long idStory);

    Optional<CardEntity> findByIdStoryAndId(Long idStory, Long id);

    Optional<CardEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
