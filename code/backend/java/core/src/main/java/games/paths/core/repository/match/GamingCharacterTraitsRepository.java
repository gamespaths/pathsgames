package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * GamingCharacterTraitsRepository - Spring Data JPA repository for the
 * "gaming_character_traits" table.
 * Step 21: the traits selected for each character instance.
 */
@Repository
public interface GamingCharacterTraitsRepository
        extends JpaRepository<GamingCharacterTraitsEntity, GamingCharacterTraitsEntityId> {

    List<GamingCharacterTraitsEntity> findByIdMatchAndIdCharacterMatch(Long idMatch, Long idCharacterMatch);

    /**
     * Every character-trait row of the match. Step 29 needs it to allocate the id of a new
     * row: the PK is (id, id_match), so the next id is the match-wide max plus one.
     */
    List<GamingCharacterTraitsEntity> findByIdMatch(Long idMatch);

    /** Deletes every character-trait row belonging to the given match ids (cleanup / cascade). */
    @Modifying
    @Query("DELETE FROM GamingCharacterTraitsEntity t WHERE t.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
