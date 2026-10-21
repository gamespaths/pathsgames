package games.paths.adapters.auth.scheduler;

import games.paths.core.port.auth.AccountPort;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests of {@link AccountDeletionScheduler} (v1.2.0).
 */
class AccountDeletionSchedulerTest {

    @Test
    void runsBothJobsWhenEnabled() {
        AccountPort port = mock(AccountPort.class);
        when(port.runDeletionJob()).thenReturn(3);
        when(port.retireInactiveUsers()).thenReturn(2);
        AccountDeletionScheduler scheduler = new AccountDeletionScheduler(port, true);
        assertEquals(3, scheduler.deleteRequestedAccounts());
        assertEquals(2, scheduler.retireInactiveAccounts());
    }

    @Test
    void doesNothingWhenDisabled() {
        AccountPort port = mock(AccountPort.class);
        AccountDeletionScheduler scheduler = new AccountDeletionScheduler(port, false);
        assertEquals(0, scheduler.deleteRequestedAccounts());
        assertEquals(0, scheduler.retireInactiveAccounts());
        verifyNoInteractions(port);
    }
}
