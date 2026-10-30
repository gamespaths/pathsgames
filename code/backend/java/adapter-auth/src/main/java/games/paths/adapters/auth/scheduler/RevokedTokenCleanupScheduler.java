package games.paths.adapters.auth.scheduler;

import games.paths.core.port.auth.SessionPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.logging.Logger;

/**
 * RevokedTokenCleanupScheduler - v1.7.0 once a day deletes the ROTATED and LOGOUT refresh tokens revoked
 * more than 7 days ago; LIMIT, LOGOUT_ALL and ADMIN rows stay until their expiry.
 */
@Component
public class RevokedTokenCleanupScheduler {

    private static final Logger LOGGER = Logger.getLogger(RevokedTokenCleanupScheduler.class.getName());

    private final SessionPort sessionPort;
    private final boolean enabled;

    public RevokedTokenCleanupScheduler(SessionPort sessionPort,
            @Value("${game.auth.account.jobs-enabled:true}") boolean enabled) {
        this.sessionPort = sessionPort;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${game.auth.session.cleanup-cron:0 12 1 * * ?}", zone = "UTC")
    public int purgeRevokedTokens() {
        if (!enabled) {
            return 0;
        }
        int removed = sessionPort.purgeRevokedTokens();
        LOGGER.info("[SESSION CLEANUP] " + removed + " rotated or logged-out tokens removed");
        return removed;
    }
}
