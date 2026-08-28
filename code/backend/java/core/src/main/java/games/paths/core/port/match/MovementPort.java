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

    /**
     * Step 33 — {@code automaticEvents} is what the destination did about the arrival: its
     * {@code id_event_if_first_time} / {@code id_event_not_first_time} /
     * {@code id_event_if_character_enter_empty_location}, already executed. The book shows the
     * new location on its left page and these on its right. Empty in the ordinary case.
     */
    record MovementResult(String matchUuid,
                          String characterUuid,
                          Long fromLocationId,
                          String fromLocationUuid,
                          long toLocationId,
                          String toLocationUuid,
                          int energySpent,
                          /** v0.35.3 — the edge's resource price, and the backpack after it. */
                          int foodSpent,
                          int magicSpent,
                          int coinSpent,
                          int newEnergy,
                          int newFood,
                          int newMagic,
                          int newCoin,
                          int currentClock,
                          List<LocationEntryPort.AutomaticEventFired> automaticEvents,
                          /**
                           * v0.35.6 — the Step 30 verdict of the whole arrival, folded from
                           * the events above. Same shape execute-event answers, so the board
                           * reads a collapse the same way whatever caused it.
                           */
                          EventExecutionPort.EdgeStateOutcome edgeState) {

        /** An arrival that moved no edge — the ordinary move. */
        public MovementResult(String matchUuid, String characterUuid, Long fromLocationId,
                              String fromLocationUuid, long toLocationId, String toLocationUuid,
                              int energySpent, int foodSpent, int magicSpent, int coinSpent,
                              int newEnergy, int newFood, int newMagic, int newCoin,
                              int currentClock,
                              List<LocationEntryPort.AutomaticEventFired> automaticEvents) {
            this(matchUuid, characterUuid, fromLocationId, fromLocationUuid, toLocationId,
                    toLocationUuid, energySpent, foodSpent, magicSpent, coinSpent, newEnergy,
                    newFood, newMagic, newCoin, currentClock, automaticEvents,
                    EventExecutionPort.EdgeStateOutcome.none());
        }
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
     *
     * <p>{@code direction} is the AUTHORED story-edge direction, i.e. the one from
     * {@code idLocationFrom} to {@code idLocationTo} — NOT the way the character walks:
     * a two-way edge is reported from both endpoints with the same direction. The two
     * endpoint ids let a client tell the two traversals apart (same contract as
     * {@code LocationNeighborInfo} on {@code /info}) and flip the direction when the
     * listing location is {@code idLocationTo}.</p>
     */
    record NeighborCost(long idLocation,
                        String uuid,
                        String direction,
                        long idLocationFrom,
                        long idLocationTo,
                        Integer idCard,
                        CardInfo card,
                        int baseEnergyCost,
                        int entryEnergyCost,
                        int weatherEnergyCost,
                        int totalEnergyCost,
                        /** v0.35.3 — edge-only, so no breakdown to report. */
                        int costFood,
                        int costMagic,
                        int costCoin,
                        boolean conditionMet) {
    }

    /**
     * The verdict on a single move, shared by {@code /api/match/{uuid}/info} (which reports it
     * on every neighbor) and {@code POST .../action/move} (which enforces it). Mirrors
     * {@code EventExecutionPort.EventAvailability} — see {@code MovementAvailabilityChecker}.
     */
    record MovementAvailability(boolean available, MovementException.Code reason) {

        public static final MovementAvailability OK = new MovementAvailability(true, null);

        public static MovementAvailability no(MovementException.Code reason) {
            return new MovementAvailability(false, reason);
        }

        /** The reason as it travels on the wire, or null when the move is allowed. */
        public String reasonName() {
            return reason == null ? null : reason.name();
        }
    }

    /** Domain exception mapped to HTTP status codes by the controller. */
    class MovementException extends RuntimeException {
        public enum Code {
            MATCH_NOT_FOUND,
            MATCH_NOT_RUNNING,
            CHARACTER_CANNOT_ACT,
            SLEEPING,
            COMA,
            NOT_A_NEIGHBOR,
            MOVEMENT_CONDITION_NOT_MET,
            OVERWEIGHT,
            INSUFFICIENT_ENERGY,
            /** v0.35.3 — the mover cannot pay the edge's resource cost. */
            NOT_ENOUGH_COINS,
            NOT_ENOUGH_FOOD,
            NOT_ENOUGH_MAGIC,
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
