package games.paths.core.port.match;

import games.paths.core.model.story.CardInfo;

import java.util.List;

/**
 * MovementPort - inbound port for the single-player movement system (Step 28).
 * Implemented by {@code MovementService}; called by the REST/admin controllers.
 *
 * <ul>
 *   <li>{@link #startMovement(String, String, String)} — move the caller's active
 *       character to an adjacent location, paying the combined energy cost.</li>
 *   <li>{@link #listLocations(String, String)} — visited locations of the match,
 *       each enriched with the per-neighbor {@code totalEnergyCost}.</li>
 *   <li>{@link #listLocationsForAdmin(String)} — same payload without the
 *       per-user participation check (admin console, port 8044).</li>
 * </ul>
 *
 * <p>See {@code documentation_v0/Step28_MovementSystem.md}.</p>
 */
public interface MovementPort {

    /** Move the caller's character to {@code targetLocationUuid} and deduct energy. */
    MovementResult startMovement(String matchUuid, String userUuid, String targetLocationUuid);

    /**
     * Visited locations of the match (player-scoped: caller must own a character).
     * {@code lang} localizes the resolved cards (null → "en").
     */
    List<VisitedLocation> listLocations(String matchUuid, String userUuid, String lang);

    /** Visited locations of the match (admin-scoped: only MATCH_NOT_FOUND is thrown). */
    List<VisitedLocation> listLocationsForAdmin(String matchUuid, String lang);

    record MovementResult(String matchUuid,
                          String characterUuid,
                          Long fromLocationId,
                          String fromLocationUuid,
                          long toLocationId,
                          String toLocationUuid,
                          int energySpent,
                          int newEnergy,
                          int currentClock) {
    }

    /** A visited location with its current character count and move-cost neighbors. */
    record VisitedLocation(long idLocation,
                           String uuid,
                           Integer idCard,
                           CardInfo card,
                           boolean safe,
                           int characterCount,
                           List<NeighborCost> neighbors) {
    }

    /**
     * A neighbor edge with the resolved energy-cost breakdown for the current weather:
     * {@code baseEnergyCost} (edge) + {@code entryEnergyCost} (target location entry) +
     * {@code weatherEnergyCost} (weather modifier) = {@code totalEnergyCost}.
     */
    record NeighborCost(long idLocation,
                        String uuid,
                        String direction,
                        Integer idCard,
                        CardInfo card,
                        int baseEnergyCost,
                        int entryEnergyCost,
                        int weatherEnergyCost,
                        int totalEnergyCost,
                        boolean conditionMet) {
    }

    /** Domain exception mapped to HTTP status codes by the controller. */
    class MovementException extends RuntimeException {
        public enum Code {
            MATCH_NOT_FOUND,
            MATCH_NOT_RUNNING,
            CHARACTER_CANNOT_ACT,
            NOT_A_NEIGHBOR,
            MOVEMENT_CONDITION_NOT_MET,
            OVERWEIGHT,
            INSUFFICIENT_ENERGY,
            LOCATION_FULL
        }

        private final transient Code code;

        public MovementException(Code code, String message) {
            super(message);
            this.code = code;
        }

        public Code getCode() {
            return code;
        }
    }
}
