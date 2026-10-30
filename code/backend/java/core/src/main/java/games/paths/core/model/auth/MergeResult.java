package games.paths.core.model.auth;

import java.util.List;

/**
 * MergeResult - v1.2.0 what a guest merge did: matches moved to the Google user and the ids of the
 * STARTED matches set to CANCELLED (v1.7.0 step 9: also their uuids, for the login answer).
 */
public record MergeResult(int movedMatches, List<Long> cancelledMatchIds, List<String> cancelledMatchUuids) {

    public MergeResult {
        cancelledMatchIds = cancelledMatchIds != null ? List.copyOf(cancelledMatchIds) : List.of();
        cancelledMatchUuids = cancelledMatchUuids != null ? List.copyOf(cancelledMatchUuids) : List.of();
    }

    public MergeResult(int movedMatches, List<Long> cancelledMatchIds) {
        this(movedMatches, cancelledMatchIds, List.of());
    }

    public static MergeResult none() {
        return new MergeResult(0, List.of(), List.of());
    }
}
