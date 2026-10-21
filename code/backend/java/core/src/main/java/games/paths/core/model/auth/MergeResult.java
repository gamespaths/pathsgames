package games.paths.core.model.auth;

import java.util.List;

/**
 * MergeResult - v1.2.0 what a guest merge did: matches moved to the Google user and the ids of the
 * STARTED matches set to CANCELLED.
 */
public record MergeResult(int movedMatches, List<Long> cancelledMatchIds) {

    public static MergeResult none() {
        return new MergeResult(0, List.of());
    }
}
