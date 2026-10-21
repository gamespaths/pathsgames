package games.paths.adapters.auth.scheduler;

import games.paths.core.port.auth.AccountPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.logging.Logger;

/**
 * AccountDeletionScheduler - v1.2.0 finishes the deletions requested by DELETE /api/auth/me (state 7),
 * one chunk per run, and once a day moves Google users idle for 24 months to state 7.
 */
@Component
public class AccountDeletionScheduler {

    private static final Logger LOGGER = Logger.getLogger(AccountDeletionScheduler.class.getName());

    private final AccountPort accountPort;
    private final boolean enabled;

    public AccountDeletionScheduler(AccountPort accountPort,
            @Value("${game.auth.account.jobs-enabled:true}") boolean enabled) {
        this.accountPort = accountPort;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${game.auth.account.deletion-cron:0 */10 * * * ?}", zone = "UTC")
    public int deleteRequestedAccounts() {
        return enabled ? accountPort.runDeletionJob() : 0;
    }

    @Scheduled(cron = "${game.auth.account.retention-cron:0 52 0 * * ?}", zone = "UTC")
    public int retireInactiveAccounts() {
        if (!enabled) {
            return 0;
        }
        int retired = accountPort.retireInactiveUsers();
        LOGGER.info("[ACCOUNT RETENTION] " + retired + " inactive users set to deleting");
        return retired;
    }
}
