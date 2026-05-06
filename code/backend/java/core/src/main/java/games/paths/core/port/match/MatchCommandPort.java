package games.paths.core.port.match;

import games.paths.core.model.match.MatchCreateCommand;
import games.paths.core.model.match.MatchSummary;

/**
 * MatchCommandPort - Inbound port for write-side match operations.
 * Step 19: exposes single-player match creation; further commands
 * (start, abandon, ...) will extend this port in subsequent steps.
 */
public interface MatchCommandPort {

    /**
     * Creates a new match for the given user, story and difficulty.
     * Performs validation, persists the match, and seeds
     * {@code gaming_state_locations} and {@code gaming_state_registry}.
     *
     * @return the created match, or {@code null} when validation fails.
     * @throws MatchCreationException for explicit business-rule failures
     *         (banned user, missing story/difficulty, maintenance mode).
     */
    MatchSummary createMatch(MatchCreateCommand command);

    /**
     * MatchCreationException - thrown when a match cannot be created
     * because of a domain error. The {@link #getCode()} value drives the
     * HTTP status mapping inside the controller layer.
     */
    class MatchCreationException extends RuntimeException {

        public enum Code {
            INVALID_INPUT,
            STORY_NOT_FOUND,
            DIFFICULTY_NOT_FOUND,
            USER_NOT_FOUND,
            USER_BANNED,
            MAINTENANCE_MODE,
            STORY_HAS_NO_LOCATIONS
        }

        private final Code code;

        public MatchCreationException(Code code, String message) {
            super(message);
            this.code = code;
        }

        public Code getCode() { return code; }
    }
}
