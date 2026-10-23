package games.paths.core.model.match;

import java.util.List;
import java.util.Set;

/**
 * MatchStatuses - the lifecycle statuses of a {@code gaming_match} row.
 *
 * <p>A match is "stopped" (terminal) when it is {@code ENDED} or
 * {@code GAMEOVER} or (v1.2.0) {@code CANCELLED}; only stopped matches may be deleted by an admin.</p>
 */
public final class MatchStatuses {

    public static final String CREATED  = "CREATED";
    public static final String RUNNING  = "RUNNING";
    public static final String PAUSED   = "PAUSED";
    public static final String ENDED    = "ENDED";
    public static final String GAMEOVER = "GAMEOVER";
    /** v1.2.0 a STARTED match that lost the guest merge to a newer one of the same story. */
    public static final String CANCELLED = "CANCELLED";
    /** v1.7.0 an active match of a banned user: terminal, treated like CANCELLED. */
    public static final String BANNED = "BANNED";

    /** Every valid status, in lifecycle order. */
    public static final List<String> ALL = List.of(CREATED, RUNNING, PAUSED, ENDED, GAMEOVER, CANCELLED, BANNED);

    /** Terminal statuses — a match in one of these is "stopped" and deletable. */
    public static final Set<String> TERMINAL = Set.of(ENDED, GAMEOVER, CANCELLED, BANNED);

    /** v1.7.0 the statuses the profile statistics count (CREATED, CANCELLED, BANNED and new ones excluded). */
    public static final List<String> PLAYED = List.of(RUNNING, PAUSED, ENDED, GAMEOVER);

    /**
     * Active (non-terminal) statuses — a match in one of these still occupies its
     * creator's slot on the story, so a second one cannot be created (v0.32.1).
     * {@code PAUSED} counts: an admin-paused match is not over, it is suspended.
     */
    public static final Set<String> ACTIVE = Set.of(CREATED, RUNNING, PAUSED);

    private MatchStatuses() {
    }

    /** Returns true when {@code status} is one of the valid match statuses. */
    public static boolean isValid(String status) {
        return status != null && ALL.contains(status);
    }

    /** Returns true when {@code status} is a terminal (stopped) status. */
    public static boolean isTerminal(String status) {
        return status != null && TERMINAL.contains(status);
    }

    /** Returns true when {@code status} is an active (non-terminal) status. */
    public static boolean isActive(String status) {
        return status != null && ACTIVE.contains(status);
    }
}
