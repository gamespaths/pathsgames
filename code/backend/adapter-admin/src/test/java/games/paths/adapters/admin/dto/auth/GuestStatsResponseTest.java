package games.paths.adapters.admin.dto.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GuestStatsResponseTest {

    @Test
    void constructor_and_setters_work() {
        GuestStatsResponse r = new GuestStatsResponse(10, 8, 2);

        assertEquals(10, r.getTotalGuests());
        assertEquals(8, r.getActiveGuests());
        assertEquals(2, r.getExpiredGuests());

        GuestStatsResponse s = new GuestStatsResponse();
        s.setTotalGuests(5);
        s.setActiveGuests(4);
        s.setExpiredGuests(1);

        assertEquals(5, s.getTotalGuests());
    }
}
