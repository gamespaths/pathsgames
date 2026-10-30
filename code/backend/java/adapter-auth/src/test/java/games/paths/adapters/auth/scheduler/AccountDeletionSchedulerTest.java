package games.paths.adapters.auth.scheduler;

import games.paths.core.port.auth.AccountPort;
import games.paths.core.port.auth.UserAdminPort;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests of {@link AccountDeletionScheduler} (v1.2.0, v1.7.0 intervention-log retention).
 */
class AccountDeletionSchedulerTest {

    @Test
    void runsBothJobsWhenEnabled() {
        AccountPort port = mock(AccountPort.class);
        UserAdminPort admin = mock(UserAdminPort.class);
        when(port.runDeletionJob()).thenReturn(3);
        when(port.retireInactiveUsers()).thenReturn(2);
        AccountDeletionScheduler scheduler = new AccountDeletionScheduler(port, admin, true);
        assertEquals(3, scheduler.deleteRequestedAccounts());
        assertEquals(2, scheduler.retireInactiveAccounts());
        verify(admin).purgeInterventionLog();
    }

    @Test
    void retentionWithoutTheAdminPortSkipsThePurge() {
        AccountPort port = mock(AccountPort.class);
        when(port.retireInactiveUsers()).thenReturn(1);
        assertEquals(1, new AccountDeletionScheduler(port, null, true).retireInactiveAccounts());
    }

    @Test
    void doesNothingWhenDisabled() {
        AccountPort port = mock(AccountPort.class);
        UserAdminPort admin = mock(UserAdminPort.class);
        AccountDeletionScheduler scheduler = new AccountDeletionScheduler(port, admin, false);
        assertEquals(0, scheduler.deleteRequestedAccounts());
        assertEquals(0, scheduler.retireInactiveAccounts());
        verifyNoInteractions(port, admin);
    }
}
