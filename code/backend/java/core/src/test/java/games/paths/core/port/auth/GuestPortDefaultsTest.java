package games.paths.core.port.auth;

import games.paths.core.model.auth.StaleGuestsSummary;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.*;

/** v0.41.0 — the default methods the ports gained keep today's calls meaning what they meant. */
class GuestPortDefaultsTest {

    @Test
    void theOneArgumentStalePurgeIsTheOneWithMatches() {
        GuestAdminPort port = mock(GuestAdminPort.class, CALLS_REAL_METHODS);
        StaleGuestsSummary summary = new StaleGuestsSummary(1, 2);
        doReturn(summary).when(port).previewStaleGuests(30, false);
        doReturn(summary).when(port).deleteStaleGuests(30, false);

        assertSame(summary, port.previewStaleGuests(30));
        assertSame(summary, port.deleteStaleGuests(30));
    }

    @Test
    void anAgedGuestFallsBackToAPlainOneOnAnOlderPort() {
        GuestAuthPort port = mock(GuestAuthPort.class, CALLS_REAL_METHODS);
        doReturn(null).when(port).createGuestSession("robottest");

        port.createGuestSession("robottest", 400);

        verify(port).createGuestSession("robottest");
    }
}
