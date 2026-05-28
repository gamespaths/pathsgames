package games.paths.adapters.auth.scheduler;

import games.paths.core.port.auth.GuestAuthPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.*;

class GuestSessionCleanupSchedulerTest {

    private GuestAuthPort guestAuthPort;
    private GuestSessionCleanupScheduler scheduler;

    @BeforeEach
    void setup() {
        guestAuthPort = mock(GuestAuthPort.class);
        scheduler = new GuestSessionCleanupScheduler(guestAuthPort);
    }

    @Test
    void cleanupExpiredSessions_callsPort() {
        when(guestAuthPort.cleanupExpiredGuestSessions()).thenReturn(2);

        scheduler.cleanupExpiredSessions();

        verify(guestAuthPort).cleanupExpiredGuestSessions();
    }
}
