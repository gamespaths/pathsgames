package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingTurnQueueEntity;
import games.paths.core.entity.match.GamingTurnQueueEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for {@link GamingTurnQueueEntity} (Step 24).
 */
@Repository
public interface GamingTurnQueueRepository
        extends JpaRepository<GamingTurnQueueEntity, GamingTurnQueueEntityId> {

    /** Turn queue of a match, highest priority first (acts first). */
    List<GamingTurnQueueEntity> findByIdMatchOrderByPriorityDesc(Long idMatch);

    Optional<GamingTurnQueueEntity> findByIdMatchAndIdCharacterMatch(Long idMatch, Long idCharacterMatch);

    /** Bulk delete (executes immediately) so a fresh queue can be inserted in the same tx. */
    @Modifying
    @Query("delete from GamingTurnQueueEntity t where t.idMatch = :idMatch")
    void deleteByIdMatch(@Param("idMatch") Long idMatch);
}
