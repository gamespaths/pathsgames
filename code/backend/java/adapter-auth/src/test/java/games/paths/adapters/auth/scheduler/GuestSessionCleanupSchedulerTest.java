package games.paths.adapters.auth.scheduler;

import games.paths.core.model.auth.StaleGuestsSummary;
import games.paths.core.port.auth.GuestAdminPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class GuestSessionCleanupSchedulerTest {

    private GuestAdminPort guestAdminPort;
    private GuestSessionCleanupScheduler scheduler;

    @BeforeEach
    void setup() {
        guestAdminPort = mock(GuestAdminPort.class);
        scheduler = new GuestSessionCleanupScheduler(guestAdminPort, true, 60);
    }

    @Test
    void cleanupExpiredSessions_callsPort() {
        // v0.41.0 — the job runs the match-less idle cleanup, nothing else
        when(guestAdminPort.deleteStaleGuests(60, true)).thenReturn(new StaleGuestsSummary(2, 0));

        assertEquals(2, scheduler.cleanupExpiredSessions());

        verify(guestAdminPort).deleteStaleGuests(60, true);
        verifyNoMoreInteractions(guestAdminPort);
    }

    @Test
    void cleanupExpiredSessions_disabledDoesNothing() {
        scheduler = new GuestSessionCleanupScheduler(guestAdminPort, false, 60);

        assertEquals(0, scheduler.cleanupExpiredSessions());

        verify(guestAdminPort, never()).deleteStaleGuests(anyInt(), anyBoolean());
    }

    @Test
    void cleanupExpiredSessions_negativeAgeDoesNothing() {
        scheduler = new GuestSessionCleanupScheduler(guestAdminPort, true, -1);

        assertEquals(0, scheduler.cleanupExpiredSessions());

        verifyNoInteractions(guestAdminPort);
    }
}
