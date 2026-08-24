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

    /**
     * v0.35.3 — persist the mover's backpack after an edge cost. Separate from the
     * position/energy write because the row lives in another table, but called inside the
     * same transaction: a character who paid the food must be the one who moved.
     */
    void updateBackpackResources(long idMatch, long idCharacter, int food, int magic, int coin);

    /** Append a {@code log_movements} row for a successful move. */
    void insertMovementLog(long idMatch, long idCharacter, Long fromLocation, long toLocation,
                           int energyCost, int foodCost, int magicCost, int coinCost);

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
                             boolean isComa,
                             /** v0.35.3 — the backpack, for the edge resource costs. */
                             int food,
                             int magic,
                             int coin) {

        /** Pre-v0.35.3 shape: a character read without its backpack. */
        @SuppressWarnings("java:S107")
        public MoveCharacterView(long id, String uuid, long idUser, Long idLocation,
                                 int energy, int energyMax, int carriedWeight, int weightMax,
                                 boolean isSleeping, boolean isComa) {
            this(id, uuid, idUser, idLocation, energy, energyMax, carriedWeight, weightMax,
                    isSleeping, isComa, 0, 0, 0);
        }
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
                        String conditionValue,
                        int flagBack,
                        /**
                         * v0.35.3 — resources this edge costs. Unlike energy, which sums the
                         * edge, the destination's entry cost and the weather modifier, these
                         * have one source: the edge itself.
                         */
                        int costFood,
                        int costMagic,
                        int costCoin) {

        /** Pre-v0.35.3 shape: an edge that costs energy and nothing else. */
        @SuppressWarnings("java:S107")
        public NeighborEdge(long idLocationFrom, long idLocationTo, String direction,
                            int energyCost, String conditionKey, String conditionValue,
                            int flagBack) {
            this(idLocationFrom, idLocationTo, direction, energyCost, conditionKey,
                    conditionValue, flagBack, 0, 0, 0);
        }

        /**
         * Whether this edge can be traversed when standing on {@code locId}.
         * Forward (locId == from) is always allowed; backward (locId == to,
         * i.e. returning to the source) only when {@code flagBack == 1}.
         */
        public boolean traversableFrom(long locId) {
            if (idLocationFrom == locId) {
                return true;
            }
            return idLocationTo == locId && flagBack == 1;
        }
    }

    record WeatherMoveCost(int costSafe, int costNotSafe) {
    }
}
