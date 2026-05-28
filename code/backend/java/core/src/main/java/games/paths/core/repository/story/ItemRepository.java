package games.paths.core.repository.story;

import games.paths.core.entity.story.ItemEntity;
import games.paths.core.entity.story.StoryScopedEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * ItemRepository - Spring Data JPA repository for the "list_items" table.
 * Provides CRUD + custom query methods for item management.
 */
@Repository
public interface ItemRepository extends JpaRepository<ItemEntity, StoryScopedEntityId> {

    List<ItemEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);

    Optional<ItemEntity> findByIdStoryAndUuid(Long idStory, String uuid);

    @Modifying
    @Transactional
    void deleteByUuid(String uuid);
}
