package games.paths.core.model.auth;

/**
 * GuestStats - Domain model for aggregate guest user statistics.
 * Immutable value object used by admin dashboard.
 */
public class GuestStats {

    private final long totalGuests;
    private final long activeGuests;
    private final long expiredGuests;

    public GuestStats(long totalGuests, long activeGuests, long expiredGuests) {
        this.totalGuests = totalGuests;
        this.activeGuests = activeGuests;
        this.expiredGuests = expiredGuests;
    }

    public long getTotalGuests() { return totalGuests; }
    public long getActiveGuests() { return activeGuests; }
    public long getExpiredGuests() { return expiredGuests; }
}
