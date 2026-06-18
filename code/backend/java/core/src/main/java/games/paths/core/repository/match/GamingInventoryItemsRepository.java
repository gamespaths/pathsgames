package games.paths.core.repository.match;

import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntityId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * GamingInventoryItemsRepository - Spring Data JPA repository for the
 * "gaming_inventory_items" table.
 * Step 27: the items a character carries inside a match.
 */
@Repository
public interface GamingInventoryItemsRepository
        extends JpaRepository<GamingInventoryItemsEntity, GamingInventoryItemsEntityId> {

    List<GamingInventoryItemsEntity> findByIdMatchAndIdCharacterMatch(Long idMatch, Long idCharacterMatch);

    /** Deletes every inventory row belonging to the given match ids (cleanup / cascade). */
    @Modifying
    @Query("DELETE FROM GamingInventoryItemsEntity i WHERE i.idMatch IN :matchIds")
    int deleteByMatchIdIn(@Param("matchIds") List<Long> matchIds);
}
