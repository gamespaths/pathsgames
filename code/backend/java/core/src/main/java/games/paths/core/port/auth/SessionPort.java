package games.paths.core.port.auth;

import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.model.auth.TokenInfo;

/**
 * SessionPort - Inbound port for session and token management.
 * Handles token refresh (with rotation), logout, and token validation.
 * Implemented by {@link games.paths.core.service.auth.SessionService}.
 */
public interface SessionPort {

    /**
     * Refreshes an expired or active access token using a valid refresh token.
     * Token rotation: revokes ALL previous tokens for the user, generates a new pair.
     *
     * @param refreshToken the current refresh token
     * @return a new session with fresh access and refresh tokens, or null if invalid
     */
    RefreshedSession refreshToken(String refreshToken);

    /**
     * Revokes a single refresh token (logout from one device/channel).
     *
     * @param refreshToken the refresh token to revoke
     * @return true if the token was found and revoked, false otherwise
     */
    boolean logout(String refreshToken);

    /**
     * Revokes all active tokens for a user (logout from all devices).
     *
     * @param userUuid the user's public UUID
     * @return true if the user was found and tokens revoked, false otherwise
     */
    boolean revokeAllSessions(String userUuid);

    /**
     * Validates an access token and returns the parsed claims.
     *
     * @param accessToken the JWT access token string
     * @return parsed TokenInfo if valid, null if expired/invalid/malformed
     */
    TokenInfo validateAccessToken(String accessToken);
}
