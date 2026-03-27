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
    private static final int GUEST_SESSION_DAYS = 30;

    private final JwtPort jwtPort;
    private final GuestPersistencePort persistencePort;

    public GuestAuthService(JwtPort jwtPort, GuestPersistencePort persistencePort) {
        this.jwtPort = jwtPort;
        this.persistencePort = persistencePort;
    }

    @Override
    public GuestSession createGuestSession() {
        // 1. Generate anonymous UUID identity
        String userUuid = UUID.randomUUID().toString();
        String username = GUEST_USERNAME_PREFIX + userUuid.substring(0, 8);
        String guestCookieToken = UUID.randomUUID().toString();

        // 2. Calculate guest session expiration (30 days)
        Instant expiresAt = Instant.now().plus(GUEST_SESSION_DAYS, ChronoUnit.DAYS);
        String expiresAtIso = expiresAt.toString();

        // 3. Persist guest user in database (state=6 for guest)
        long userId = persistencePort.createGuestUser(userUuid, username, guestCookieToken, expiresAtIso);

        // 4. Issue JWT tokens
        String accessToken = jwtPort.generateAccessToken(userUuid, username, GUEST_ROLE);
        String refreshToken = jwtPort.generateRefreshToken(userUuid);

        // 5. Store refresh token
        long refreshExpiresMs = jwtPort.getRefreshTokenExpirationMs();
        String refreshExpiresAt = Instant.ofEpochMilli(refreshExpiresMs).toString();
        persistencePort.storeRefreshToken(userId, refreshToken, refreshExpiresAt);

        // 6. Update last access
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

    @Override
    public GuestSession resumeGuestSession(String guestCookieToken) {
        if (guestCookieToken == null || guestCookieToken.isBlank()) {
            return null;
        }

        // Look up guest user by cookie token
        Map<String, Object> guestData = persistencePort.findGuestByCookieToken(guestCookieToken);
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
        persistencePort.storeRefreshToken(userId, refreshToken, refreshExpiresAt);

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

    @Override
    public int cleanupExpiredGuestSessions() {
        return persistencePort.deleteExpiredGuests();
    }
}
