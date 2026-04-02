package games.paths.core.service.auth;

import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.model.auth.TokenInfo;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.SessionPort;
import games.paths.core.port.auth.TokenPersistencePort;

import java.time.Instant;
import java.util.Map;

/**
 * SessionService - Domain service implementing session and token management.
 * This is pure domain logic with no Spring/framework dependency.
 * Handles token refresh (with rotation), logout, and access token validation.
 *
 * Token rotation policy: every refresh revokes ALL previous tokens for the user
 * and issues a brand-new pair (access + refresh).
 *
 * Max active tokens: enforced at creation time (login/guest). When a new session
 * is created and the user exceeds the limit, the oldest token is revoked.
 */
public class SessionService implements SessionPort {

    private static final int MAX_TOKENS_PER_USER = 5;

    private final JwtPort jwtPort;
    private final TokenPersistencePort tokenPersistencePort;
    private final int maxTokensPerUser;

    public SessionService(JwtPort jwtPort, TokenPersistencePort tokenPersistencePort) {
        this(jwtPort, tokenPersistencePort, MAX_TOKENS_PER_USER);
    }

    public SessionService(JwtPort jwtPort, TokenPersistencePort tokenPersistencePort, int maxTokensPerUser) {
        this.jwtPort = jwtPort;
        this.tokenPersistencePort = tokenPersistencePort;
        this.maxTokensPerUser = maxTokensPerUser;
    }

    @Override
    public RefreshedSession refreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return null;
        }

        // 1. Validate JWT signature and expiry
        if (!jwtPort.validateToken(refreshToken)) {
            return null;
        }

        // 2. Parse claims from the refresh token
        Map<String, Object> claims = jwtPort.parseToken(refreshToken);
        if (claims == null) {
            return null;
        }

        // 3. Verify it's a refresh token
        String type = (String) claims.get("type");
        if (!"refresh".equals(type)) {
            return null;
        }

        // 4. Check if the refresh token is not revoked in DB
        if (!tokenPersistencePort.isRefreshTokenValid(refreshToken)) {
            return null;
        }

        // 5. Get user info associated with this refresh token
        Map<String, Object> userData = tokenPersistencePort.findUserByRefreshToken(refreshToken);
        if (userData == null) {
            return null;
        }

        String userUuid = (String) userData.get("uuid");
        String username = (String) userData.get("username");
        String role = (String) userData.get("role");
        Object idObj = userData.get("id");
        if (userUuid == null || username == null || idObj == null) {
            return null;
        }
        long userId = ((Number) idObj).longValue();

        // 6. Token rotation: revoke ALL previous tokens for this user
        tokenPersistencePort.revokeAllUserTokens(userId);

        // 7. Generate new token pair
        String newAccessToken = jwtPort.generateAccessToken(userUuid, username, role != null ? role : "PLAYER");
        String newRefreshToken = jwtPort.generateRefreshToken(userUuid);

        // 8. Store new refresh token
        long refreshExpiresMs = jwtPort.getRefreshTokenExpirationMs();
        String refreshExpiresAt = Instant.ofEpochMilli(refreshExpiresMs).toString();
        tokenPersistencePort.storeRefreshToken(userId, newRefreshToken, refreshExpiresAt);

        return RefreshedSession.builder()
                .userUuid(userUuid)
                .username(username)
                .role(role != null ? role : "PLAYER")
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .accessTokenExpiresAt(jwtPort.getAccessTokenExpirationMs())
                .refreshTokenExpiresAt(refreshExpiresMs)
                .build();
    }

    @Override
    public boolean logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return false;
        }

        return tokenPersistencePort.revokeRefreshToken(refreshToken);
    }

    @Override
    public boolean revokeAllSessions(String userUuid) {
        if (userUuid == null || userUuid.isBlank()) {
            return false;
        }

        long userId = tokenPersistencePort.findUserIdByUuid(userUuid);
        if (userId < 0) {
            return false;
        }

        tokenPersistencePort.revokeAllUserTokens(userId);
        return true;
    }

    @Override
    public TokenInfo validateAccessToken(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            return null;
        }

        // Validate JWT signature and expiry
        if (!jwtPort.validateToken(accessToken)) {
            return null;
        }

        // Parse claims
        Map<String, Object> claims = jwtPort.parseToken(accessToken);
        if (claims == null) {
            return null;
        }

        // Verify it's an access token
        String type = (String) claims.get("type");
        if (!"access".equals(type)) {
            return null;
        }

        String userUuid = (String) claims.get("sub");
        String username = (String) claims.get("username");
        String role = (String) claims.get("role");
        String tokenId = (String) claims.get("jti");

        if (userUuid == null) {
            return null;
        }

        long issuedAt = 0;
        long expiresAt = 0;
        Object iatObj = claims.get("iat");
        Object expObj = claims.get("exp");
        if (iatObj instanceof Number) {
            issuedAt = ((Number) iatObj).longValue();
        }
        if (expObj instanceof Number) {
            expiresAt = ((Number) expObj).longValue();
        }

        return TokenInfo.builder()
                .userUuid(userUuid)
                .username(username)
                .role(role)
                .type(type)
                .tokenId(tokenId)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();
    }
}
