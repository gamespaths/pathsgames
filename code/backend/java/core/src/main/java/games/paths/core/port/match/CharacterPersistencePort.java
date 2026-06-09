package games.paths.core.port.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;

import java.util.List;
import java.util.Optional;

/**
 * CharacterPersistencePort - Outbound port used by the character command
 * service to persist a new character instance and read the few rows it needs
 * for validation. Step 21.
 */
public interface CharacterPersistencePort {

    GamingCharacterInstanceEntity saveCharacter(GamingCharacterInstanceEntity entity);

    void saveBackpack(GamingBackpackResourcesEntity entity);

    void saveTraits(List<GamingCharacterTraitsEntity> entities);

    /** Returns the character already owned by the user in the match, if any (already-joined check). */
    Optional<GamingCharacterInstanceEntity> findCharacterByMatchIdAndUserId(Long matchId, Long userId);

    /** Number of characters already present in the match (used to assign the next composite id). */
    int countCharactersByMatchId(Long matchId);
}
