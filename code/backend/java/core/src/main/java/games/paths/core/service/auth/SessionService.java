package games.paths.core.service.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.model.auth.RevokeReasons;
import games.paths.core.model.auth.StoredRefreshToken;
import games.paths.core.model.auth.TokenInfo;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.AccountGuardPort;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.SessionPort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.auth.UserStatePort;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;

/**
 * SessionService - Domain service implementing session and token management (no framework dependency).
 * v1.2.0 refresh revokes only the used token, hashed tokens, state check; v1.7.0 cap of 12 sessions
 * (SESSION_LIMIT), 2-minute grace, reuse detection, guest refresh capped at 180 days, sessions_valid_after.
 */
public class SessionService implements SessionPort {

    public static final int DEFAULT_MAX_TOKENS_PER_USER = 12;
    /** A just-rotated refresh token is still accepted this long (two tabs refreshing at once). */
    public static final long GRACE_SECONDS = 120;
    /** activeSessions counts only the sessions refreshed in the last 30 days. */
    public static final int ACTIVE_SESSION_DAYS = 30;
    /** A guest refresh token never outlives the guest cookie. */
    public static final int GUEST_REFRESH_DAYS = 180;

    private final JwtPort jwtPort;
    private final TokenPersistencePort tokenPersistencePort;
    private final int maxTokensPerUser;
    private Clock clock = Clock.systemUTC();
    private AccountGuardPort guard;
    private UserStatePort userState;

    public SessionService(JwtPort jwtPort, TokenPersistencePort tokenPersistencePort) {
        this(jwtPort, tokenPersistencePort, DEFAULT_MAX_TOKENS_PER_USER);
    }

    public SessionService(JwtPort jwtPort, TokenPersistencePort tokenPersistencePort, int maxTokensPerUser) {
        this.jwtPort = jwtPort;
        this.tokenPersistencePort = tokenPersistencePort;
        this.maxTokensPerUser = maxTokensPerUser;
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    /** v1.7.0 a refresh after the end of a suspension unblocks the user (step 10). */
    public void setAccountGuard(AccountGuardPort guard) {
        this.guard = guard;
    }

    /** v1.7.0 "log out of all devices" evicts the user so sessions_valid_after applies at once. */
    public void setUserState(UserStatePort userState) {
        this.userState = userState;
    }

    /**
     * Null when the token is unknown, malformed or expired; AuthException SESSION_LIMIT when the cap revoked
     * it, SESSION_REVOKED otherwise (a ROTATED token reused after the grace revokes every session first)
     * and ACCOUNT_DISABLED / ACCOUNT_DELETION_IN_PROGRESS by state.
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
            if (RevokeReasons.LIMIT.equals(stored.revokedReason())) {
                throw new AuthException(AuthException.Code.SESSION_LIMIT, "Too many devices, sign in again");
            }
            if (RevokeReasons.ROTATED.equals(stored.revokedReason())) {
                tokenPersistencePort.findUserById(stored.userId()).ifPresent(this::cutAllSessions);
            }
            throw new AuthException(AuthException.Code.SESSION_REVOKED, "The session was closed");
        }
        Optional<UserStatus> userOpt = tokenPersistencePort.findUserById(stored.userId());
        if (userOpt.isEmpty() || !userOpt.get().uuid().equals(claims.get("sub"))) {
            return null;
        }
        UserStatus user = userOpt.get();
        if (guard != null) {
            user = guard.admit(user);
        } else {
            UserStates.requireUsable(user.state());
        }
        // v1.10.0 issued before the last "log out of all devices": refused also in the grace (state refusals first)
        if (!user.acceptsTokenIssuedAt(number(claims.get("iat")) / 1000)) {
            throw new AuthException(AuthException.Code.SESSION_REVOKED, "The session was closed");
        }
        if (!stored.revoked()) {
            tokenPersistencePort.markRotated(stored.id(), now.toString());
        }

        String newAccessToken = jwtPort.generateAccessToken(user.uuid(), user.username(), user.role());
        String newRefreshToken = jwtPort.generateRefreshToken(user.uuid());
        long refreshExpiresMs = refreshExpiry(jwtPort.getRefreshTokenExpirationMs(), user.isGuest(), now);
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
        tokenPersistencePort.findUserById(userId).ifPresentOrElse(this::cutAllSessions,
                () -> tokenPersistencePort.revokeAllUserTokens(userId));
        return true;
    }

    /** Every session revoked (LOGOUT_ALL) and the access tokens issued until now refused. */
    private void cutAllSessions(UserStatus user) {
        tokenPersistencePort.revokeAllUserTokens(user.id());
        tokenPersistencePort.setSessionsValidAfter(user.id(), validAfter(clock.instant()));
        if (userState != null) {
            userState.evict(user.uuid());
        }
    }

    @Override
    public int activeSessions(String userUuid) {
        if (userUuid == null || userUuid.isBlank()) {
            return 0;
        }
        long userId = tokenPersistencePort.findUserIdByUuid(userUuid);
        if (userId < 0) {
            return 0;
        }
        return tokenPersistencePort.countActiveTokensIssuedAfter(userId,
                clock.instant().minus(ACTIVE_SESSION_DAYS, ChronoUnit.DAYS).toString());
    }

    @Override
    public int purgeRevokedTokens() {
        return tokenPersistencePort.deleteShortLivedRevokedTokens(
                clock.instant().minus(RevokeReasons.SHORT_RETENTION_DAYS, ChronoUnit.DAYS).toString());
    }

    /** The stored expiry of a new refresh token: a guest's never beyond 180 days from now. */
    public static long refreshExpiry(long tokenExpiresMs, boolean guest, Instant now) {
        return guest ? Math.min(tokenExpiresMs, now.plus(GUEST_REFRESH_DAYS, ChronoUnit.DAYS).toEpochMilli())
                : tokenExpiresMs;
    }

    /** sessions_valid_after at seconds precision: a token is valid when its iat is not before it. */
    public static String validAfter(Instant now) {
        return now.truncatedTo(ChronoUnit.SECONDS).toString();
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
