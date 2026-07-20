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

    /** Admin: persist updated base stats (dex/int/con/energy/life/sad) on the character instance. */
    void updateCharacterStats(Long matchId, Long characterId,
                              Integer dex, Integer intel, Integer con,
                              Integer energy, Integer life, Integer sad);

    /**
     * Admin: persist the character's state flags. A null flag is left as it is.
     * Waking a character out of a coma is what a rescue will do on its own in step 59; until
     * then this is the only way back.
     */
    void updateCharacterFlags(Long matchId, Long characterId,
                              Boolean sleeping, Boolean coma);

    /** Admin: persist updated backpack resources (food/magic/coin). */
    void updateBackpackStats(Long matchId, Long characterId,
                             Integer food, Integer magic, Integer coin);
}
