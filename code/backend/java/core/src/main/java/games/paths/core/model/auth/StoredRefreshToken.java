package games.paths.core.model.auth;

/**
 * StoredRefreshToken - v1.2.0 one users_tokens row found by hash: its rotation time drives the grace window
 * of a concurrent refresh; v1.7.0 the revocation reason (SESSION_LIMIT, reuse detection).
 */
public record StoredRefreshToken(long id, long userId, boolean revoked, String expiresAt, String tsRotated,
                                 String revokedReason) {

    public StoredRefreshToken(long id, long userId, boolean revoked, String expiresAt, String tsRotated) {
        this(id, userId, revoked, expiresAt, tsRotated, null);
    }
}
