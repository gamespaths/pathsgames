package games.paths.core.model.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link GuestStats}.
 */
class GuestStatsTest {

    @Test
    @DisplayName("All-args constructor stores values and getters return them correctly")
    void constructor_storesValues() {
        GuestStats stats = new GuestStats(100L, 80L, 20L);

        assertAll(
            () -> assertEquals(100L, stats.getTotalGuests()),
            () -> assertEquals(80L,  stats.getActiveGuests()),
            () -> assertEquals(20L,  stats.getExpiredGuests())
        );
    }

    @Test
    @DisplayName("Zero values are valid (empty system)")
    void constructor_zeroValues() {
        GuestStats stats = new GuestStats(0L, 0L, 0L);

        assertAll(
            () -> assertEquals(0L, stats.getTotalGuests()),
            () -> assertEquals(0L, stats.getActiveGuests()),
            () -> assertEquals(0L, stats.getExpiredGuests())
        );
    }

    @Test
    @DisplayName("Expired guests count can equal total (all expired)")
    void allExpired_scenario() {
        GuestStats stats = new GuestStats(5L, 0L, 5L);

        assertEquals(5L, stats.getTotalGuests());
        assertEquals(0L, stats.getActiveGuests());
        assertEquals(5L, stats.getExpiredGuests());
    }
}
