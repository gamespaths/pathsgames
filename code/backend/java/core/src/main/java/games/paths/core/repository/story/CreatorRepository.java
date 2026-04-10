package games.paths.core.repository.story;

import games.paths.core.entity.story.CreatorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * CreatorRepository - Spring Data JPA repository for the "list_creator" table.
 * Provides CRUD + custom query methods for creator management.
 */
@Repository
public interface CreatorRepository extends JpaRepository<CreatorEntity, Long> {

    List<CreatorEntity> findByIdStory(Long idStory);

    @Modifying
    @Transactional
    void deleteByIdStory(Long idStory);
}
