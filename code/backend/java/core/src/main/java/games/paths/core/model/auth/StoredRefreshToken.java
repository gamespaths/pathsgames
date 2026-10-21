package games.paths.core.model.auth;

/**
 * StoredRefreshToken - v1.2.0 one users_tokens row found by hash: its rotation time drives the
 * 30-second grace window of a concurrent refresh.
 */
public record StoredRefreshToken(long id, long userId, boolean revoked, String expiresAt, String tsRotated) {
}
