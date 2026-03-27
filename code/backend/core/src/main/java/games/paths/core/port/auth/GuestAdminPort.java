package games.paths.core.port.auth;

import java.util.List;

import games.paths.core.model.auth.GuestInfo;
import games.paths.core.model.auth.GuestStats;

/**
 * GuestAdminPort - Inbound port for guest user administration.
 * Defines use cases available to the admin interface.
 */
public interface GuestAdminPort {

    /**
     * Lists all guest users, ordered by registration date descending.
     */
    List<GuestInfo> listAllGuests();

    /**
     * Retrieves a single guest user by UUID.
     * Returns null if not found or if the user is not a guest (state≠6).
     */
    GuestInfo getGuestByUuid(String uuid);

    /**
     * Deletes a single guest user and all associated tokens.
     * Returns true if the guest existed and was deleted.
     */
    boolean deleteGuest(String uuid);

    /**
     * Deletes all expired guest sessions and their tokens.
     * Returns the number of deleted guest users.
     */
    int deleteExpiredGuests();

    /**
     * Returns aggregate statistics about guest users.
     */
    GuestStats getGuestStats();
}
