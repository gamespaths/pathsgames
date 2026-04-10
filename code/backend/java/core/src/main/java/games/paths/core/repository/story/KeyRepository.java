package games.paths.core.repository.story;

import games.paths.core.entity.story.KeyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * KeyRepository - Spring Data JPA repository for the "list_keys" table.
 * Provides CRUD + custom query methods for key management.
 */
@Repository
public interface KeyRepository extends JpaRepository<KeyEntity, Long> {

    List<KeyEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
