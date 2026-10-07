package games.paths.adapters.auth.scheduler;

import games.paths.core.model.auth.StaleGuestsSummary;
import games.paths.core.port.auth.GuestAdminPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.logging.Logger;

/**
 * GuestSessionCleanupScheduler - v0.41.0: once a day (00:42 UTC by default) deletes the guests
 * idle for age-days that no match references, at most max-per-run of them; the rest waits a day.
 */
@Component
public class GuestSessionCleanupScheduler {

    private static final Logger LOGGER = Logger.getLogger(GuestSessionCleanupScheduler.class.getName());

    private final GuestAdminPort guestAdminPort;
    private final boolean enabled;
    private final int ageDays;

    public GuestSessionCleanupScheduler(GuestAdminPort guestAdminPort,
            @Value("${game.admin.auth.guest.cleanup.enabled:true}") boolean enabled,
            @Value("${game.admin.auth.guest.cleanup.age-days:60}") int ageDays) {
        this.guestAdminPort = guestAdminPort;
        this.enabled = enabled;
        this.ageDays = ageDays;
    }

    /** The same service method as DELETE /api/admin/guests/stale?withoutMatches=true. */
    @Scheduled(cron = "${game.admin.auth.guest.cleanup.cron:0 42 0 * * ?}", zone = "UTC")
    public int cleanupExpiredSessions() {
        if (!enabled || ageDays < 0) {
            LOGGER.info("[GUEST CLEANUP] Disabled, nothing done");
            return 0;
        }
        LOGGER.info("[GUEST CLEANUP] Starting at " + Instant.now() + ", idle for " + ageDays + " days");
        StaleGuestsSummary summary = guestAdminPort.deleteStaleGuests(ageDays, true);
        LOGGER.info("[GUEST CLEANUP] Completed: " + summary.guests() + " idle guests without matches removed");
        return (int) summary.guests();
    }
}
