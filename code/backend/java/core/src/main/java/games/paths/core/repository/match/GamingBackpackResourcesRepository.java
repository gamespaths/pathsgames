package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingBackpackResourcesEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * GamingBackpackResourcesRepository - Spring Data JPA repository for the
 * "gaming_backpack_resources" table.
 * Step 21: one backpack row per character instance.
 */
@Repository
public interface GamingBackpackResourcesRepository
        extends JpaRepository<GamingBackpackResourcesEntity, GamingBackpackResourcesEntityId> {

    Optional<GamingBackpackResourcesEntity> findByIdMatchAndIdCharacterMatch(Long idMatch, Long idCharacterMatch);

    /** Every backpack of the match, for the per-match maps the movement gate builds. */
    List<GamingBackpackResourcesEntity> findByIdMatch(Long idMatch);

    /** Deletes every backpack row belonging to the given match ids (cleanup / cascade). */
    @Modifying
    @Query("DELETE FROM GamingBackpackResourcesEntity b WHERE b.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
