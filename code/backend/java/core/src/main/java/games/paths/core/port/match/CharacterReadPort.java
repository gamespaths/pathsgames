package games.paths.core.port.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntity;

import java.util.List;
import java.util.Optional;

/**
 * CharacterReadPort - Outbound port used by the character query service and by
 * {@code MatchQueryService.buildDetail} to read the per-match character state.
 * Step 21.
 */
public interface CharacterReadPort {

    List<GamingCharacterInstanceEntity> findCharactersByMatchId(Long matchId);

    Optional<GamingCharacterInstanceEntity> findCharacterByMatchIdAndUuid(Long matchId, String uuid);

    Optional<GamingBackpackResourcesEntity> findBackpack(Long matchId, Long characterId);

    List<GamingCharacterTraitsEntity> findTraits(Long matchId, Long characterId);

    /** Step 27 — the items carried by a character inside a match. */
    List<GamingInventoryItemsEntity> findInventory(Long matchId, Long characterId);
}
