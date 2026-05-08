package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.match.GamingStateRegistryEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * GamingStateRegistryRepository - Spring Data JPA repository for the
 * "gaming_state_registry" table.
 * Step 19: Used to seed default registry values on match creation and to
 * read the per-match registry on match-info retrieval.
 */
@Repository
public interface GamingStateRegistryRepository
        extends JpaRepository<GamingStateRegistryEntity, GamingStateRegistryEntityId> {

    List<GamingStateRegistryEntity> findByIdMatch(Long idMatch);
}
