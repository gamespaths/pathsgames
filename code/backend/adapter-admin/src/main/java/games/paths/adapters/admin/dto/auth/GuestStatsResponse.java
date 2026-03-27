package games.paths.adapters.admin.dto.auth;

/**
 * GuestStatsResponse - REST response DTO for guest statistics.
 */
public class GuestStatsResponse {

    private long totalGuests;
    private long activeGuests;
    private long expiredGuests;

    public GuestStatsResponse() {}

    public GuestStatsResponse(long totalGuests, long activeGuests, long expiredGuests) {
        this.totalGuests = totalGuests;
        this.activeGuests = activeGuests;
        this.expiredGuests = expiredGuests;
    }

    public long getTotalGuests() { return totalGuests; }
    public void setTotalGuests(long totalGuests) { this.totalGuests = totalGuests; }

    public long getActiveGuests() { return activeGuests; }
    public void setActiveGuests(long activeGuests) { this.activeGuests = activeGuests; }

    public long getExpiredGuests() { return expiredGuests; }
    public void setExpiredGuests(long expiredGuests) { this.expiredGuests = expiredGuests; }
}
