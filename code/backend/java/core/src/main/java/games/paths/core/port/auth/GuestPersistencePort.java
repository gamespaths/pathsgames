package games.paths.core.port.auth;

import java.util.Map;

/**
 * GuestPersistencePort - Outbound port for guest user persistence (users with state=6).
 * v1.2.0 the guest cookie token and the refresh token are stored as SHA-256 hash.
 */
public interface GuestPersistencePort {

    long createGuestUser(String uuid, String username, String guestCookieTokenHash, String guestExpiresAt);

    /** The guest by cookie hash, else (legacyClearToken not null) by clear value, rewritten as hash. */
    Map<String, Object> findGuestByCookieToken(String guestCookieTokenHash, String legacyClearToken);

    void storeRefreshToken(long userId, String refreshTokenHash, String expiresAt);

    void updateLastAccess(long userId);

    int deleteExpiredGuests();

    void backdateGuest(long userId, String instant);
}
