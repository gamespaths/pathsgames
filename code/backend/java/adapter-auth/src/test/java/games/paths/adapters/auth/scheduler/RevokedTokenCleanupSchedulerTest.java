package games.paths.adapters.auth.scheduler;

import games.paths.core.port.auth.SessionPort;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** v1.7.0 the daily purge of the ROTATED and LOGOUT refresh tokens older than 7 days. */
class RevokedTokenCleanupSchedulerTest {

    @Test
    void enabledRunsThePurge() {
        SessionPort port = mock(SessionPort.class);
        when(port.purgeRevokedTokens()).thenReturn(3);
        assertEquals(3, new RevokedTokenCleanupScheduler(port, true).purgeRevokedTokens());
        verify(port).purgeRevokedTokens();
    }

    @Test
    void disabledDoesNothing() {
        SessionPort port = mock(SessionPort.class);
        assertEquals(0, new RevokedTokenCleanupScheduler(port, false).purgeRevokedTokens());
        verifyNoInteractions(port);
    }
}
