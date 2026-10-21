package games.paths.core.service.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.model.auth.StoredRefreshToken;
import games.paths.core.model.auth.TokenInfo;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.SessionPort;
import games.paths.core.port.auth.TokenPersistencePort;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * SessionService - Domain service implementing session and token management (no framework dependency).
 * v1.2.0 refresh revokes only the used token (30 s grace), hashed tokens, state check, cap of 5 sessions.
 */
public class SessionService implements SessionPort {

    private static final int MAX_TOKENS_PER_USER = 5;
    /** A just-rotated refresh token is still accepted this long (two tabs refreshing at once). */
    public static final long GRACE_SECONDS = 30;

    private final JwtPort jwtPort;
    private final TokenPersistencePort tokenPersistencePort;
    private final int maxTokensPerUser;
    private Clock clock = Clock.systemUTC();

    public SessionService(JwtPort jwtPort, TokenPersistencePort tokenPersistencePort) {
        this(jwtPort, tokenPersistencePort, MAX_TOKENS_PER_USER);
    }

    public SessionService(JwtPort jwtPort, TokenPersistencePort tokenPersistencePort, int maxTokensPerUser) {
        this.jwtPort = jwtPort;
        this.tokenPersistencePort = tokenPersistencePort;
        this.maxTokensPerUser = maxTokensPerUser;
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    /**
     * Null when the token is unknown, malformed or expired; AuthException SESSION_REVOKED when it was
     * revoked (logout, another device) and ACCOUNT_DISABLED / ACCOUNT_DELETION_IN_PROGRESS by state.
     */
    @Override
    public RefreshedSession refreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank() || !jwtPort.validateToken(refreshToken)) {
            return null;
        }
        Map<String, Object> claims = jwtPort.parseToken(refreshToken);
        if (claims == null || !"refresh".equals(claims.get("type"))) {
            return null;
        }
        Instant now = clock.instant();
        Optional<StoredRefreshToken> found = tokenPersistencePort.findRefreshToken(
                TokenHasher.sha256(refreshToken), TokenHasher.legacy(refreshToken, now));
        if (found.isEmpty() || expired(found.get().expiresAt(), now)) {
            return null;
        }
        StoredRefreshToken stored = found.get();
        if (stored.revoked() && !inGrace(stored.tsRotated(), now)) {
            throw new AuthException(AuthException.Code.SESSION_REVOKED, "The session was closed");
        }
        Optional<UserStatus> userOpt = tokenPersistencePort.findUserById(stored.userId());
        if (userOpt.isEmpty() || !userOpt.get().uuid().equals(claims.get("sub"))) {
            return null;
        }
        UserStatus user = userOpt.get();
        UserStates.requireUsable(user.state());
        if (!stored.revoked()) {
            tokenPersistencePort.markRotated(stored.id(), now.toString());
        }

        String newAccessToken = jwtPort.generateAccessToken(user.uuid(), user.username(), user.role());
        String newRefreshToken = jwtPort.generateRefreshToken(user.uuid());
        long refreshExpiresMs = jwtPort.getRefreshTokenExpirationMs();
        tokenPersistencePort.storeRefreshToken(user.id(), TokenHasher.sha256(newRefreshToken),
                Instant.ofEpochMilli(refreshExpiresMs).toString());
        tokenPersistencePort.revokeOldestTokensIfLimitExceeded(user.id(), maxTokensPerUser);
        tokenPersistencePort.updateLastAccess(user.id());

        return RefreshedSession.builder()
                .userUuid(user.uuid())
                .username(user.username())
                .role(user.role())
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
        return tokenPersistencePort.revokeRefreshToken(TokenHasher.sha256(refreshToken),
                TokenHasher.legacy(refreshToken, clock.instant()));
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
        if (accessToken == null || accessToken.isBlank() || !jwtPort.validateToken(accessToken)) {
            return null;
        }
        Map<String, Object> claims = jwtPort.parseToken(accessToken);
        if (claims == null || !"access".equals(claims.get("type"))) {
            return null;
        }
        String userUuid = (String) claims.get("sub");
        if (userUuid == null) {
            return null;
        }
        return new TokenInfo(userUuid, (String) claims.get("username"), (String) claims.get("role"), "access",
                (String) claims.get("jti"), number(claims.get("iat")), number(claims.get("exp")));
    }

    private static long number(Object value) {
        return value instanceof Number n ? n.longValue() : 0;
    }

    private static boolean expired(String expiresAt, Instant now) {
        if (expiresAt == null) {
            return false;
        }
        try {
            return now.isAfter(Instant.parse(expiresAt));
        } catch (RuntimeException unreadable) {
            return true;
        }
    }

    private static boolean inGrace(String tsRotated, Instant now) {
        if (tsRotated == null || tsRotated.isBlank()) {
            return false;
        }
        try {
            return !now.isAfter(Instant.parse(tsRotated).plusSeconds(GRACE_SECONDS));
        } catch (RuntimeException unreadable) {
            return false;
        }
    }
}
