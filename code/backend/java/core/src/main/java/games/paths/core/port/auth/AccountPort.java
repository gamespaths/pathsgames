package games.paths.core.port.auth;

import games.paths.core.model.auth.UserProfile;

import java.util.Optional;

/**
 * AccountPort - v1.2.0 the profile of GET /api/auth/me, the deletion of DELETE /api/auth/me and the
 * jobs that finish deletions and retire users inactive for 24 months.
 */
public interface AccountPort {

    Optional<UserProfile> profile(String userUuid);

    /** Sets the user to deleting (7) after a fresh Google ID token check; throws AuthException. */
    void requestDeletion(String userUuid, String idToken, String nonce);

    /** Deletes at most one chunk of users in state 7; answers how many were removed. */
    int runDeletionJob();

    /** Moves Google users idle for the retention period to state 7; answers how many. */
    int retireInactiveUsers();
}
