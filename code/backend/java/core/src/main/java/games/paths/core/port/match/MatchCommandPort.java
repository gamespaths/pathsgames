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
     * Outcome of an admin match update ({@code PUT}/{@code POST} actions).
     */
    enum UpdateOutcome {
        /** The match was updated. */
        UPDATED,
        /** No match exists with the given uuid. */
        NOT_FOUND,
        /** The requested status is not one of the valid match statuses. */
        INVALID_STATUS
    }

    /**
     * Updates the admin-editable fields of a match (status and/or name).
     *
     * @param uuidMatch the match uuid
     * @param status    the new status, or {@code null} to leave it unchanged
     * @param name      the new name, or {@code null} to leave it unchanged
     * @return the outcome of the update
     */
    UpdateOutcome updateMatch(String uuidMatch, String status, String name);

    /**
     * Outcome of an admin match deletion.
     */
    enum DeleteOutcome {
        /** The match (and its runtime state) was deleted. */
        DELETED,
        /** No match exists with the given uuid. */
        NOT_FOUND,
        /** The match is not in a terminal (stopped) status, so it cannot be deleted. */
        NOT_STOPPED
    }

    /**
     * Deletes a match together with its derived runtime state. Only matches in
     * a terminal status (ENDED / GAMEOVER) may be deleted.
     *
     * @param uuidMatch the match uuid
     * @return the outcome of the deletion
     */
    DeleteOutcome deleteMatch(String uuidMatch);

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
