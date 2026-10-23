package games.paths.core.port.auth;

import games.paths.core.model.auth.UserPreferences;
import games.paths.core.model.auth.UserProfile;
import games.paths.core.model.auth.UserStats;

import java.util.List;
import java.util.Optional;

/**
 * AccountPort - v1.2.0 the profile of GET /api/auth/me, the deletion of DELETE /api/auth/me and the
 * jobs that finish deletions and retire users inactive for 24 months.
 */
public interface AccountPort {

    Optional<UserProfile> profile(String userUuid);

    /** v1.7.0 the statistics of the matches the user created, computed on the fly. */
    UserStats stats(String userUuid);

    /** v1.7.0 language and theme of the user; empty when unknown. */
    Optional<UserPreferences> preferences(String userUuid);

    /**
     * v1.7.0 PATCH /api/auth/me: a null field is left unchanged; throws AuthException
     * (GOOGLE_ACCOUNT_REQUIRED for a guest, INVALID_REQUEST for a value outside the supported lists).
     */
    UserPreferences updatePreferences(String userUuid, String language, String theme);

    /** v1.7.0 the languages a profile may choose. */
    List<String> supportedLanguages();

    /** v1.7.0 the themes a profile may choose. */
    List<String> supportedThemes();

    /** Sets the user to deleting (7) after a fresh Google ID token check; throws AuthException. */
    void requestDeletion(String userUuid, String idToken, String nonce);

    /** Deletes at most one chunk of users in state 7; answers how many were removed. */
    int runDeletionJob();

    /** Moves Google users idle for the retention period to state 7; answers how many. */
    int retireInactiveUsers();
}
