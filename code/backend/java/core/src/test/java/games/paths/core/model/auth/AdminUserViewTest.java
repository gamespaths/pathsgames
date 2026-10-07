package games.paths.core.model.auth;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/** AdminUserView (v0.41.6): guest, expiry and the move eligibility rules. */
class AdminUserViewTest {

    private static final Instant NOW = Instant.parse("2026-10-03T10:00:00Z");

    private static AdminUserView v(String role, Integer state, String expires) {
        return new AdminUserView(1L, "u", "n", null, null, role, state, expires, null, null, 0);
    }

    @Test
    void expiryRules() {
        assertFalse(v("PLAYER", 6, null).isExpired(NOW));
        assertFalse(v("PLAYER", 6, " ").isExpired(NOW));
        assertFalse(v("PLAYER", 6, "garbage").isExpired(NOW));
        assertFalse(v("PLAYER", 6, "2027-01-01T00:00:00Z").isExpired(NOW));
        assertTrue(v("PLAYER", 6, "2026-01-01T00:00:00Z").isExpired(NOW));
        assertFalse(v("PLAYER", 2, "2026-01-01T00:00:00Z").isExpired(NOW));
        assertFalse(v("PLAYER", null, null).isGuest());
    }

    @Test
    void eligibility() {
        assertTrue(v("PLAYER", 2, null).isEligible(NOW));
        assertTrue(v("PLAYER", 6, null).isEligible(NOW));
        assertEquals("USER_NOT_ALLOWED", v("admin", 2, null).reason(NOW));
        assertEquals("USER_NOT_ALLOWED", v("PLAYER", 3, null).reason(NOW));
        assertEquals("USER_NOT_ALLOWED", v("PLAYER", null, null).reason(NOW));
        assertEquals("USER_EXPIRED", v("PLAYER", 6, "2026-01-01T00:00:00Z").reason(NOW));
        assertEquals(5L, v("PLAYER", 2, null).withMatchCount(5).matchCount());
    }
}
