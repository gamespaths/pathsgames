package games.paths.core.port.auth;

import java.util.Map;

/**
 * GuestPersistencePort - Outbound port for guest user persistence operations.
 * Implemented by a database adapter (SQLite/PostgreSQL) to store and retrieve guest data.
 */
public interface GuestPersistencePort {

    /**
     * Creates a new guest user in the database.
     *
     * @param uuid             the unique UUID for the guest user
     * @param username         the generated guest username (e.g., "guest_abc12345")
     * @param guestCookieToken the cookie token for session resumption
     * @param guestExpiresAt   the ISO-8601 timestamp when the guest session expires
     * @return the database-generated user ID
     */
    long createGuestUser(String uuid, String username, String guestCookieToken, String guestExpiresAt);

    /**
     * Finds a guest user by their cookie token.
     *
     * @param guestCookieToken the cookie token to search for
     * @return a map with user fields (id, uuid, username, guest_expires_at), or null if not found
     */
    Map<String, Object> findGuestByCookieToken(String guestCookieToken);

    /**
     * Stores a refresh token for a user.
     *
     * @param userId       the user ID
     * @param refreshToken the refresh token string
     * @param expiresAt    the ISO-8601 timestamp when the token expires
     */
    void storeRefreshToken(long userId, String refreshToken, String expiresAt);

    /**
     * Updates the last access timestamp for a user.
     *
     * @param userId the user ID
     */
    void updateLastAccess(long userId);

    /**
     * Deletes expired guest users and their associated tokens.
     *
     * @return the number of guest users removed
     */
    int deleteExpiredGuests();
}
