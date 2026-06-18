package games.paths.core.port.match;

import java.util.List;

/**
 * TurnCyclePort - inbound port for the single-player turn cycle engine (Step 24).
 * Implemented by {@code TurnCycleService}; called by the REST controller.
 */
public interface TurnCyclePort {

    /** Transition CREATED → RUNNING, build the turn queue, activate the first turn. */
    TurnSequenceResult startMatch(String matchUuid, String userUuid);

    /** Voluntarily pass the active character's turn (no energy cost). */
    PassResult passTurn(String matchUuid, String userUuid);

    /** Read the current turn queue with statuses. */
    TurnSequenceResult getTurnSequence(String matchUuid, String userUuid);

    /** One entry of the turn queue as exposed to callers. */
    record TurnEntry(String characterUuid,
                     long idCharacter,
                     String name,
                     long priority,
                     int clock,
                     String status,
                     int passCounter,
                     String timestampStart,
                     String timestampEnd) {
    }

    record TurnSequenceResult(String matchUuid,
                              int currentClock,
                              String status,
                              String activeCharacterUuid,
                              List<TurnEntry> queue) {
    }

    record PassResult(String matchUuid,
                      String passedCharacterUuid,
                      String nextActiveCharacterUuid,
                      String status) {
    }

    /** Domain exception mapped to HTTP status codes by the controller. */
    class TurnCycleException extends RuntimeException {
        public enum Code {
            MATCH_NOT_FOUND,
            MATCH_NOT_STARTABLE,
            NO_CHARACTERS_JOINED,
            MATCH_NOT_RUNNING,
            NOT_YOUR_TURN
        }

        private final transient Code code;

        public TurnCycleException(Code code, String message) {
            super(message);
            this.code = code;
        }

        public Code getCode() {
            return code;
        }
    }
}
