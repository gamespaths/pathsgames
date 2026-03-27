package games.paths.core.port.auth;

/**
 * JwtPort - Outbound port for JWT token operations.
 * Implemented by the auth adapter to generate and validate JWT tokens.
 */
public interface JwtPort {

    /**
     * Generates a JWT access token for the given user.
     *
     * @param userUuid the user's UUID
     * @param username the user's username
     * @param role     the user's role (e.g., "PLAYER", "ADMIN")
     * @return the signed JWT access token string
     */
    String generateAccessToken(String userUuid, String username, String role);

    /**
     * Generates a JWT refresh token for the given user.
     *
     * @param userUuid the user's UUID
     * @return the signed JWT refresh token string
     */
    String generateRefreshToken(String userUuid);

    /**
     * Returns the access token expiration time in milliseconds from now.
     *
     * @return expiration timestamp in epoch milliseconds
     */
    long getAccessTokenExpirationMs();

    /**
     * Returns the refresh token expiration time in milliseconds from now.
     *
     * @return expiration timestamp in epoch milliseconds
     */
    long getRefreshTokenExpirationMs();
}
