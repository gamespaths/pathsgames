package games.paths.core.port.auth;

import java.util.List;

import games.paths.core.model.auth.GuestInfo;
import games.paths.core.model.auth.GuestInfoPage;
import games.paths.core.model.auth.GuestListFilter;
import games.paths.core.model.auth.StaleGuestsSummary;
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
     * v0.41.0: a guest still referenced by a match, character, session or chat row is kept.
     * Returns the number of deleted guest users.
     */
    int deleteExpiredGuests();

    /**
     * v0.36.2 — one page of guests, most recently seen first. The console asked for the whole
     * table before this, which on a real dataset is a scan and a timeout.
     */
    GuestInfoPage listGuestsPage(GuestListFilter filter);

    /** How many guests, and how many of their matches, a purge at this bound would take. */
    default StaleGuestsSummary previewStaleGuests(int olderThanDays) {
        return previewStaleGuests(olderThanDays, false);
    }

    /**
     * Delete every guest last seen more than N days ago, AND every match they created —
     * whatever its status. Matches go first: a match references its creator by foreign key.
     */
    default StaleGuestsSummary deleteStaleGuests(int olderThanDays) {
        return deleteStaleGuests(olderThanDays, false);
    }

    /** v0.41.0 — withoutMatches: only unreferenced guests, at most max-per-run, matches untouched. */
    StaleGuestsSummary previewStaleGuests(int olderThanDays, boolean withoutMatches);

    /** v0.41.0 — the purge above; {@code withoutMatches} is what the daily cleanup job runs. */
    StaleGuestsSummary deleteStaleGuests(int olderThanDays, boolean withoutMatches);

    /**
     * Returns aggregate statistics about guest users.
     */
    GuestStats getGuestStats();
}
