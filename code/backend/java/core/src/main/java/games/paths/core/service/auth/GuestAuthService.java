package games.paths.core.service.auth;

import games.paths.core.model.auth.GuestSession;
import games.paths.core.port.auth.GuestPersistencePort;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.GuestAuthPort;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

/**
 * GuestAuthService - Domain service implementing guest authentication.
 * This is pure domain logic with no Spring/framework dependency.
 * Ports are injected via constructor by the launcher configuration.
 */
public class GuestAuthService implements GuestAuthPort {

    private static final String GUEST_ROLE = "PLAYER";
    private static final String GUEST_USERNAME_PREFIX = "guest_";
    private static final int GUEST_SESSION_DAYS = 180;
    /** Maximum length of a sanitized test marker used as a username prefix. */
    private static final int MAX_MARKER_LENGTH = 30;
    /** v0.41.0 — the accepted range of X-Test-Guest-Age-Days. */
    static final int MAX_AGE_DAYS = 3650;

    private final JwtPort jwtPort;
    private final GuestPersistencePort persistencePort;
    private games.paths.core.port.auth.TokenPersistencePort tokenPersistencePort;
    private int maxTokensPerUser = 5;

    public GuestAuthService(JwtPort jwtPort, GuestPersistencePort persistencePort) {
        this.jwtPort = jwtPort;
        this.persistencePort = persistencePort;
    }

    @Override
    public GuestSession createGuestSession(String testMarker) {
        return createGuestSession(testMarker, null);
    }

    @Override
    public GuestSession createGuestSession(String testMarker, Integer ageDays) {
        // 1. Generate anonymous UUID identity
        String userUuid = UUID.randomUUID().toString();
        String prefix = resolveUsernamePrefix(testMarker);
        String username = prefix + userUuid.substring(0, 8);
        String guestCookieToken = UUID.randomUUID().toString();
        // v0.41.0 — an aged guest needs a valid marker too, so it is always test data
        Instant bornAt = Instant.now();
        boolean aged = !GUEST_USERNAME_PREFIX.equals(prefix)
                && ageDays != null && ageDays >= 1 && ageDays <= MAX_AGE_DAYS;
        if (aged) {
            bornAt = bornAt.minus(ageDays, ChronoUnit.DAYS);
        }

        // 2. Calculate guest session expiration (6 months / 180 days)
        Instant expiresAt = bornAt.plus(GUEST_SESSION_DAYS, ChronoUnit.DAYS);
        String expiresAtIso = expiresAt.toString();

        // 3. Persist guest user in database (state=6 for guest); v1.2.0 the cookie token as hash
        long userId = persistencePort.createGuestUser(userUuid, username, TokenHasher.sha256(guestCookieToken),
                expiresAtIso);

        // 4. Issue JWT tokens
        String accessToken = jwtPort.generateAccessToken(userUuid, username, GUEST_ROLE);
        String refreshToken = jwtPort.generateRefreshToken(userUuid);

        // 5. Store refresh token
        long refreshExpiresMs = jwtPort.getRefreshTokenExpirationMs();
        String refreshExpiresAt = Instant.ofEpochMilli(refreshExpiresMs).toString();
        storeRefresh(userId, refreshToken, refreshExpiresAt);

        // 6. Update last access
        persistencePort.updateLastAccess(userId);
        if (aged) {
            persistencePort.backdateGuest(userId, bornAt.toString());
        }

        return GuestSession.builder()
                .userUuid(userUuid)
                .username(username)
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .accessTokenExpiresAt(jwtPort.getAccessTokenExpirationMs())
                .refreshTokenExpiresAt(refreshExpiresMs)
                .guestCookieToken(guestCookieToken)
                .build();
    }

    @Override
    public GuestSession resumeGuestSession(String guestCookieToken) {
        if (guestCookieToken == null || guestCookieToken.isBlank()) {
            return null;
        }

        // Look up guest user by cookie token hash (v1.2.0 lazy migration of a clear value)
        Map<String, Object> guestData = persistencePort.findGuestByCookieToken(
                TokenHasher.sha256(guestCookieToken), TokenHasher.legacy(guestCookieToken, Instant.now()));
        if (guestData == null) {
            return null;
        }

        String userUuid = (String) guestData.get("uuid");
        String username = (String) guestData.get("username");
        Object idObj = guestData.get("id");
        if (userUuid == null || username == null || idObj == null) {
            return null;
        }
        long userId = ((Number) idObj).longValue();
        String expiresAtStr = (String) guestData.get("guest_expires_at");

        // Check if the guest session is still valid
        if (expiresAtStr != null) {
            Instant expiresAt = Instant.parse(expiresAtStr);
            if (Instant.now().isAfter(expiresAt)) {
                return null; // Session expired
            }
        }

        // Issue new JWT tokens
        String accessToken = jwtPort.generateAccessToken(userUuid, username, GUEST_ROLE);
        String refreshToken = jwtPort.generateRefreshToken(userUuid);

        // Store new refresh token
        long refreshExpiresMs = jwtPort.getRefreshTokenExpirationMs();
        String refreshExpiresAt = Instant.ofEpochMilli(refreshExpiresMs).toString();
        storeRefresh(userId, refreshToken, refreshExpiresAt);

        // Update last access
        persistencePort.updateLastAccess(userId);

        return GuestSession.builder()
                .userUuid(userUuid)
                .username(username)
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .accessTokenExpiresAt(jwtPort.getAccessTokenExpirationMs())
                .refreshTokenExpiresAt(refreshExpiresMs)
                .guestCookieToken(guestCookieToken)
                .build();
    }

    /** v1.2.0 the cap of active sessions per user, also on guest create and resume. */
    public void setTokenPersistence(games.paths.core.port.auth.TokenPersistencePort port, int maxTokens) {
        this.tokenPersistencePort = port;
        this.maxTokensPerUser = maxTokens;
    }

    private void storeRefresh(long userId, String refreshToken, String expiresAt) {
        persistencePort.storeRefreshToken(userId, TokenHasher.sha256(refreshToken), expiresAt);
        if (tokenPersistencePort != null) {
            tokenPersistencePort.revokeOldestTokensIfLimitExceeded(userId, maxTokensPerUser);
        }
    }

    @Override
    public int cleanupExpiredGuestSessions() {
        return persistencePort.deleteExpiredGuests();
    }

    /**
     * Resolves the username prefix for a new guest.
     *
     * <p>With a non-blank test marker (only forwarded by the REST adapter when
     * dev endpoints are enabled) the sanitized marker becomes the prefix, so the
     * guest can later be removed by the test-data cleanup. Otherwise the
     * standard {@code guest_} prefix is used.</p>
     *
     * @param testMarker the raw marker, or {@code null}
     * @return the username prefix, always ending with an underscore
     */
    private String resolveUsernamePrefix(String testMarker) {
        if (testMarker == null || testMarker.isBlank()) {
            return GUEST_USERNAME_PREFIX;
        }
        String sanitized = testMarker.toLowerCase().replaceAll("[^a-z0-9]", "");
        if (sanitized.isEmpty()) {
            return GUEST_USERNAME_PREFIX;
        }
        if (sanitized.length() > MAX_MARKER_LENGTH) {
            sanitized = sanitized.substring(0, MAX_MARKER_LENGTH);
        }
        return sanitized + "_";
    }
}
