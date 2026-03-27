package games.paths.adapters.auth.scheduler;

import games.paths.core.port.auth.GuestAuthPort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.logging.Logger;

/**
 * GuestSessionCleanupScheduler - Scheduled task to clean up expired guest sessions.
 * Runs every 6 hours to remove guest users whose sessions have expired.
 */
@Component
public class GuestSessionCleanupScheduler {

    private static final Logger LOGGER = Logger.getLogger(GuestSessionCleanupScheduler.class.getName());

    private final GuestAuthPort guestAuthPort;

    public GuestSessionCleanupScheduler(GuestAuthPort guestAuthPort) {
        this.guestAuthPort = guestAuthPort;
    }

    /**
     * Cleanup expired guest sessions every 6 hours.
     * Cron: 0 42 0 * * ? (runs at 00:42 every day, can be adjusted as needed)
     * 
     */ //(for testing, can be changed to every 6 hours: 0 0 */6 * * ?)
    @Scheduled(cron = "${game.admin.auth.guest.cleanup.cron:0 42 0 * * ?}")
    public void cleanupExpiredSessions() {
        LOGGER.info("[GUEST SESSION CLEANUP] Starting guest session cleanup at " + Instant.now());
        int removed = guestAuthPort.cleanupExpiredGuestSessions();
        LOGGER.info("[GUEST SESSION CLEANUP] Guest session cleanup completed: " + removed + " expired sessions removed");
    }
}
