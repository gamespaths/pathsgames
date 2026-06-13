package games.paths.core.model.match;

import java.util.List;

/**
 * Turn lifecycle statuses for a {@code gaming_turn_queue} row (Step 24):
 * WAITING → ACTIVE → COMPLETED.
 */
public final class TurnStatuses {

    public static final String WAITING = "WAITING";
    public static final String ACTIVE = "ACTIVE";
    public static final String COMPLETED = "COMPLETED";

    public static final List<String> ALL = List.of(WAITING, ACTIVE, COMPLETED);

    private TurnStatuses() {
    }

    public static boolean isValid(String status) {
        return status != null && ALL.contains(status);
    }
}
