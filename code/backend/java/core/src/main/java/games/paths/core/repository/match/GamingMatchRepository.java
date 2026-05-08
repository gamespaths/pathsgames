package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingMatchEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * GamingMatchRepository - Spring Data JPA repository for the "gaming_match" table.
 * Step 19: CRUD support for single-player match creation and retrieval.
 */
@Repository
public interface GamingMatchRepository extends JpaRepository<GamingMatchEntity, Long> {

    Optional<GamingMatchEntity> findByUuid(String uuid);

    List<GamingMatchEntity> findByIdUserCreatorOrderByTsInsertDesc(Long idUserCreator);

    long countByIdUserCreatorAndStatusIn(Long idUserCreator, List<String> statuses);
}
