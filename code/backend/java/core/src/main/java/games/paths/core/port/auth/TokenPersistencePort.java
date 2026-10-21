package games.paths.core.port.auth;

import games.paths.core.model.auth.StoredRefreshToken;
import games.paths.core.model.auth.UserStatus;

import java.util.Optional;

/**
 * TokenPersistencePort - Outbound port for refresh token persistence (users_tokens).
 * v1.2.0 tokens are stored as SHA-256 hash; a legacy clear value found is rewritten as hash.
 */
public interface TokenPersistencePort {

    /** The row by hash, else (legacyClearToken not null) by clear value, rewritten as hash. */
    Optional<StoredRefreshToken> findRefreshToken(String tokenHash, String legacyClearToken);

    /** Revokes a token because it was rotated by a refresh: the grace window starts now. */
    void markRotated(long tokenId, String now);

    /** Revokes a token (logout); false when absent or already revoked. */
    boolean revokeRefreshToken(String tokenHash, String legacyClearToken);

    int revokeAllUserTokens(long userId);

    int countActiveTokensByUserId(long userId);

    void storeRefreshToken(long userId, String tokenHash, String expiresAt);

    long findUserIdByUuid(String userUuid);

    void revokeOldestTokensIfLimitExceeded(long userId, int maxTokens);

    Optional<UserStatus> findUserById(long userId);

    void updateLastAccess(long userId);
}
