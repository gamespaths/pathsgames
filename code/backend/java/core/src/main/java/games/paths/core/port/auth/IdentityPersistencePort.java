package games.paths.core.port.auth;

import games.paths.core.model.auth.NewUser;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStatus;

import java.util.List;
import java.util.Optional;

/**
 * IdentityPersistencePort - v1.2.0 users, users_identities and the ID-token replay store, for the
 * Google login, the account deletion job and the admin bootstrap.
 */
public interface IdentityPersistencePort {

    Optional<UserIdentity> findIdentityByEmail(String provider, String email);

    List<UserIdentity> findIdentitiesOfUser(long userId);

    Optional<UserStatus> findUserById(long userId);

    Optional<UserStatus> findUserByUuid(String uuid);

    Optional<UserStatus> findUserByNickname(String nickname);

    /** The user with this users.email_address (lowercase), identity or not. */
    Optional<UserStatus> findUserByEmail(String email);

    boolean nicknameExists(String nickname);

    /** One transaction: the user and, when not null, its identity; throws DuplicateUserException on a clash. */
    long createUser(NewUser user, UserIdentity identity);

    void createIdentity(long userId, UserIdentity identity);

    void updateIdentityProfile(long identityId, UserIdentity profile);

    void updateLastAccess(long userId);

    void updateState(long userId, int state);

    /** v1.7.0 users.theme_selected of the user; empty when unknown or not set. */
    Optional<String> findThemeSelected(long userId);

    /** v1.7.0 users.language and users.theme_selected; a null value is left unchanged. */
    void updatePreferences(long userId, String language, String theme);

    /** False when the hash is already stored (a replayed ID token). */
    boolean markIdTokenSeen(String tokenHash, String expiresAt);

    int deleteExpiredIdTokens(String now);

    List<Long> findUserIdsByState(int state, int limit);

    /** Users with an identity whose last access (or registration) predates the bound, not yet deleting. */
    List<Long> findInactiveIdentityUserIds(String lastAccessBefore, int limit);

    /** Identities, tokens, sessions, chat rows and the user itself; its matches must be gone already. */
    void deleteUserFully(long userId);

    /** Non-guest users whose nickname matches the LIKE pattern (Robot test data). */
    List<Long> findNonGuestUserIdsByNicknameLike(String pattern);

    /** v1.2.0 a unique-index clash on insert: the field is "nickname", "email" or "other". */
    class DuplicateUserException extends RuntimeException {
        private final String field;

        public DuplicateUserException(String field) {
            super("Duplicate user " + field);
            this.field = field;
        }

        public String getField() {
            return field;
        }
    }
}
