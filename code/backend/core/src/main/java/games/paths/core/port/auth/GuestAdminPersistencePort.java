package games.paths.core.port.auth;

import java.util.List;
import java.util.Map;

/**
 * GuestAdminPersistencePort - Outbound port for admin-level guest persistence.
 * Provides read and delete operations for managing guest users from
 * the admin interface. Implemented by the auth persistence adapter.
 */
public interface GuestAdminPersistencePort {

    /**
     * Returns all guest users (state=6) as a list of property maps.
     * Each map contains: uuid, username, nickname, role, state, language,
     * guestCookieToken, guestExpiresAt, tsRegistration, tsLastAccess.
     */
    List<Map<String, Object>> findAllGuests();

    /**
     * Returns a single guest by UUID and state=6.
     * Returns null if not found.
     */
    Map<String, Object> findGuestByUuid(String uuid);

    /**
     * Deletes a guest user and all associated tokens by UUID.
     * Returns true if a guest was found and deleted.
     */
    boolean deleteGuestByUuid(String uuid);

    /**
     * Deletes all expired guest sessions (guestExpiresAt < now) and their tokens.
     * Returns the number of deleted guest users.
     */
    int deleteExpiredGuests();

    /**
     * Counts total guest users (state=6).
     */
    long countAllGuests();

    /**
     * Counts active (non-expired) guest users.
     */
    long countActiveGuests();

    /**
     * Counts expired guest users.
     */
    long countExpiredGuests();
}
