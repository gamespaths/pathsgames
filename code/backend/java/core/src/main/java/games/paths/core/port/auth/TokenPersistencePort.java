package games.paths.core.port.auth;

import games.paths.core.model.auth.RevokeReasons;
import games.paths.core.model.auth.StoredRefreshToken;
import games.paths.core.model.auth.UserStatus;

import java.util.Optional;

/**
 * TokenPersistencePort - Outbound port for refresh token persistence (users_tokens).
 * v1.2.0 tokens are stored as SHA-256 hash; v1.7.0 every revocation stores its reason.
 */
public interface TokenPersistencePort {

    /** The row by hash, else (legacyClearToken not null) by clear value, rewritten as hash. */
    Optional<StoredRefreshToken> findRefreshToken(String tokenHash, String legacyClearToken);

    /** Revokes a token because it was rotated by a refresh (reason ROTATED): the grace window starts now. */
    void markRotated(long tokenId, String now);

    /** Revokes a token (logout, reason LOGOUT); false when absent or already revoked. */
    boolean revokeRefreshToken(String tokenHash, String legacyClearToken);

    /** Revokes every active token of the user with reason LOGOUT_ALL. */
    default int revokeAllUserTokens(long userId) {
        return revokeAllUserTokens(userId, RevokeReasons.LOGOUT_ALL);
    }

    /** v1.7.0 revokes every active token of the user with the given reason (LOGOUT_ALL, ADMIN). */
    int revokeAllUserTokens(long userId, String reason);

    int countActiveTokensByUserId(long userId);

    /** v1.7.0 active (not revoked, not expired) tokens issued at or after issuedAfter (ISO-8601). */
    int countActiveTokensIssuedAfter(long userId, String issuedAfter);

    void storeRefreshToken(long userId, String tokenHash, String expiresAt);

    long findUserIdByUuid(String userUuid);

    /** Revokes the oldest active tokens above the cap with reason LIMIT. */
    void revokeOldestTokensIfLimitExceeded(long userId, int maxTokens);

    Optional<UserStatus> findUserById(long userId);

    void updateLastAccess(long userId);

    /** v1.7.0 users.sessions_valid_after (ISO-8601, seconds): access tokens issued before it are refused. */
    void setSessionsValidAfter(long userId, String validAfter);

    /** v1.7.0 deletes the ROTATED and LOGOUT rows revoked before the bound (ISO-8601); the count removed. */
    int deleteShortLivedRevokedTokens(String revokedBefore);
}
