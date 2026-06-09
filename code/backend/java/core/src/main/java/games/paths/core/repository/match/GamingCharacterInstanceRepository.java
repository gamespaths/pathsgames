package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * GamingCharacterInstanceRepository - Spring Data JPA repository for the
 * "gaming_character_instance" table.
 * Step 21: read/write of the per-match character instances.
 */
@Repository
public interface GamingCharacterInstanceRepository
        extends JpaRepository<GamingCharacterInstanceEntity, GamingCharacterInstanceEntityId> {

    List<GamingCharacterInstanceEntity> findByIdMatch(Long idMatch);

    Optional<GamingCharacterInstanceEntity> findByIdMatchAndUuid(Long idMatch, String uuid);

    Optional<GamingCharacterInstanceEntity> findByIdMatchAndIdUser(Long idMatch, Long idUser);

    long countByIdMatch(Long idMatch);

    /** Deletes every character row belonging to the given match ids (cleanup / cascade). */
    @Modifying
    @Query("DELETE FROM GamingCharacterInstanceEntity c WHERE c.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
