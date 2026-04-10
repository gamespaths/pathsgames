package games.paths.core.repository.story;

import games.paths.core.entity.story.ItemEffectEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * ItemEffectRepository - Spring Data JPA repository for the "list_items_effects" table.
 * Provides CRUD + custom query methods for item effect management.
 */
@Repository
public interface ItemEffectRepository extends JpaRepository<ItemEffectEntity, Long> {

    List<ItemEffectEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
