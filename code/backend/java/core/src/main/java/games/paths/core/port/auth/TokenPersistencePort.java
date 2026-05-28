package games.paths.core.port.auth;

import java.util.Map;

/**
 * TokenPersistencePort - Outbound port for token persistence operations.
 * Handles refresh token storage, revocation, and user lookup for session management.
 * Implemented by a database adapter (SQLite/PostgreSQL).
 */
public interface TokenPersistencePort {

    /**
     * Checks if a refresh token is valid (exists, not revoked, not expired).
     *
     * @param refreshToken the refresh token string
     * @return true if valid, false otherwise
     */
    boolean isRefreshTokenValid(String refreshToken);

    /**
     * Finds user information associated with a refresh token.
     *
     * @param refreshToken the refresh token string
     * @return a map with {id, uuid, username, role, state} or null if not found
     */
    Map<String, Object> findUserByRefreshToken(String refreshToken);

    /**
     * Revokes a single refresh token.
     *
     * @param refreshToken the refresh token to revoke
     * @return true if the token was found and revoked
     */
    boolean revokeRefreshToken(String refreshToken);

    /**
     * Revokes all active refresh tokens for a given user.
     *
     * @param userId the internal user ID
     * @return the number of tokens revoked
     */
    int revokeAllUserTokens(long userId);

    /**
     * Counts the number of active (non-revoked, non-expired) refresh tokens for a user.
     *
     * @param userId the internal user ID
     * @return the count of active tokens
     */
    int countActiveTokensByUserId(long userId);

    /**
     * Stores a new refresh token for a user.
     *
     * @param userId       the internal user ID
     * @param refreshToken the refresh token string
     * @param expiresAt    the ISO-8601 expiration timestamp
     */
    void storeRefreshToken(long userId, String refreshToken, String expiresAt);

    /**
     * Finds the internal user ID by public UUID.
     *
     * @param userUuid the public UUID
     * @return the internal ID, or -1 if not found
     */
    long findUserIdByUuid(String userUuid);

    /**
     * Revokes the oldest active tokens if the user exceeds the maximum allowed.
     * Keeps at most {@code maxTokens} active tokens.
     *
     * @param userId    the internal user ID
     * @param maxTokens the maximum number of active tokens allowed
     */
    void revokeOldestTokensIfLimitExceeded(long userId, int maxTokens);
}
