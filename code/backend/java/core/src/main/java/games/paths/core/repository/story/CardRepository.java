package games.paths.core.repository.story;

import games.paths.core.entity.story.CardEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * CardRepository - Spring Data JPA repository for the "list_cards" table.
 * Provides CRUD + custom query methods for card management.
 */
@Repository
public interface CardRepository extends JpaRepository<CardEntity, Long> {

    List<CardEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
