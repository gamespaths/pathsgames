package games.paths.core.port.auth;

import java.util.Map;

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

    /**
     * Parses a JWT token and returns its claims as a map.
     * Returns null if the token is invalid, expired, or malformed.
     *
     * @param token the JWT token string
     * @return a map of claims {sub, username, role, type, jti, iat, exp} or null
     */
    Map<String, Object> parseToken(String token);

    /**
     * Validates a JWT token's signature and expiration.
     *
     * @param token the JWT token string
     * @return true if the token is valid (correct signature and not expired)
     */
    boolean validateToken(String token);
}
