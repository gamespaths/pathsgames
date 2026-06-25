package games.paths.core.port.match;

import java.util.List;
import java.util.Optional;

/**
 * MovementStorePort - outbound port used by {@code MovementService} (Step 28) to
 * read the match / character / location / neighbor / weather state and to persist
 * the movement outcome (character position + energy) and a {@code log_movements} row.
 *
 * <p>Read-then-write like the other Step 24-27 store ports, keeping the movement
 * domain logic framework-free and unit-testable.</p>
 */
public interface MovementStorePort {

    Optional<MatchMovementView> findMatchByUuid(String uuid);

    /** The character instance owned by {@code idUser} in {@code idMatch}, if any. */
    Optional<MoveCharacterView> findCharacterByMatchAndUser(long idMatch, long idUser);

    /** Every character instance of the match (used for per-location counts). */
    List<MoveCharacterView> findCharactersByMatchId(long idMatch);

    /** Resolve a story location by uuid. */
    Optional<MoveLocationView> findLocationByStoryAndUuid(long idStory, String uuid);

    /** Resolve a story location by its (story-local) id. */
    Optional<MoveLocationView> findLocationByStoryAndId(long idStory, long idLocation);

    /** Neighbor edges of {@code idLocation} (either endpoint), for the story. */
    List<NeighborEdge> findNeighborsOfLocation(long idStory, long idLocation);

    /** Current registry value for a key (condition checks); empty when absent. */
    Optional<String> findRegistryValue(long idMatch, String key);

    /** Current weather move costs (0/0 when no weather is selected). */
    WeatherMoveCost findCurrentWeatherMoveCost(long idMatch);

    /** How many characters are currently at {@code idLocation} in the match. */
    int countCharactersAtLocation(long idMatch, long idLocation);

    /** Persist the new character position and clamped energy. */
    void updateCharacterLocationAndEnergy(long idMatch, long idCharacter, long idLocation, int energy);

    /** Append a {@code log_movements} row for a successful move. */
    void insertMovementLog(long idMatch, long idCharacter, Long fromLocation, long toLocation, int energyCost);

    /**
     * The set of visited location ids: current character positions plus every
     * {@code from}/{@code to} recorded in {@code log_movements}.
     */
    List<Long> findVisitedLocationIds(long idMatch);

    record MatchMovementView(long id,
                             String uuid,
                             String status,
                             int currentClock,
                             long idStory,
                             long idUserCreator) {
    }

    record MoveCharacterView(long id,
                             String uuid,
                             long idUser,
                             Long idLocation,
                             int energy,
                             int energyMax,
                             int carriedWeight,
                             int weightMax,
                             boolean isSleeping,
                             boolean isComa) {
    }

    record MoveLocationView(long id,
                            String uuid,
                            Integer idCard,
                            int secureParam,
                            int costEnergyEnter,
                            int maxCharacters) {
    }

    record NeighborEdge(long idLocationFrom,
                        long idLocationTo,
                        String direction,
                        int energyCost,
                        String conditionKey,
                        String conditionValue) {
    }

    record WeatherMoveCost(int costSafe, int costNotSafe) {
    }
}
