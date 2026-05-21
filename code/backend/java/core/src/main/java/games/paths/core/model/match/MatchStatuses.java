package games.paths.core.model.match;

import java.util.List;
import java.util.Set;

/**
 * MatchStatuses - the lifecycle statuses of a {@code gaming_match} row.
 *
 * <p>A match is "stopped" (terminal) when it is {@code ENDED} or
 * {@code GAMEOVER}; only stopped matches may be deleted by an admin.</p>
 */
public final class MatchStatuses {

    public static final String CREATED  = "CREATED";
    public static final String RUNNING  = "RUNNING";
    public static final String PAUSED   = "PAUSED";
    public static final String ENDED    = "ENDED";
    public static final String GAMEOVER = "GAMEOVER";

    /** Every valid status, in lifecycle order. */
    public static final List<String> ALL = List.of(CREATED, RUNNING, PAUSED, ENDED, GAMEOVER);

    /** Terminal statuses — a match in one of these is "stopped" and deletable. */
    public static final Set<String> TERMINAL = Set.of(ENDED, GAMEOVER);

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
}
