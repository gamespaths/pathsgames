package games.paths.core.repository.story;

import games.paths.core.entity.story.GlobalRandomEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * GlobalRandomEventRepository - Spring Data JPA repository for the "list_global_random_events" table.
 * Provides CRUD + custom query methods for global random event management.
 */
@Repository
public interface GlobalRandomEventRepository extends JpaRepository<GlobalRandomEventEntity, Long> {

    List<GlobalRandomEventEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
