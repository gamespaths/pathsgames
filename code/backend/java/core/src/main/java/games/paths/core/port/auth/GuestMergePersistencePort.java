package games.paths.core.port.auth;

import games.paths.core.model.auth.MatchOwnership;

import java.util.List;

/**
 * GuestMergePersistencePort - v1.2.0 the matches of a user and the one-transaction merge of a guest
 * into a Google user (owner move, cancellations, guest tokens and user deleted).
 */
public interface GuestMergePersistencePort {

    List<MatchOwnership> matchesOfUser(long userId);

    /** Answers the number of matches moved from the guest to the target. */
    int applyMerge(long guestUserId, long targetUserId, List<Long> cancelMatchIds, String now);
}
