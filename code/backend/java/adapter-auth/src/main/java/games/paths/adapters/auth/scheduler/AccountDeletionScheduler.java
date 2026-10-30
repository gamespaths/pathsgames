package games.paths.adapters.auth.scheduler;

import games.paths.core.port.auth.AccountPort;
import games.paths.core.port.auth.UserAdminPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.logging.Logger;

/**
 * AccountDeletionScheduler - v1.2.0 finishes the deletions requested by DELETE /api/auth/me (state 7),
 * one chunk per run, and once a day moves Google users idle for 24 months to state 7.
 * v1.7.0 the same daily run purges the admin intervention log older than 24 months.
 */
@Component
public class AccountDeletionScheduler {

    private static final Logger LOGGER = Logger.getLogger(AccountDeletionScheduler.class.getName());

    private final AccountPort accountPort;
    private final UserAdminPort userAdminPort;
    private final boolean enabled;

    public AccountDeletionScheduler(AccountPort accountPort, UserAdminPort userAdminPort,
            @Value("${game.auth.account.jobs-enabled:true}") boolean enabled) {
        this.accountPort = accountPort;
        this.userAdminPort = userAdminPort;
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
        if (userAdminPort != null) {
            LOGGER.info("[ADMIN LOG RETENTION] " + userAdminPort.purgeInterventionLog() + " rows removed");
        }
        return retired;
    }
}
