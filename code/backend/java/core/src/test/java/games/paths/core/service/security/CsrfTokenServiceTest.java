package games.paths.core.service.security;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Step 41 — the stateless CSRF token bound to an access token. */
class CsrfTokenServiceTest {

    private static final String SECRET = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!";

    @Test
    @DisplayName("The same access token always earns the same token; another one earns a different one")
    void deterministicAndBound() {
        CsrfTokenService svc = new CsrfTokenService(SECRET, true);
        String a = svc.tokenFor("eyJ.access.a");
        assertNotNull(a);
        assertEquals(a, svc.tokenFor("eyJ.access.a"));
        assertEquals(a, svc.tokenFor("  eyJ.access.a  "), "whitespace around the bearer is ignored");
        assertNotEquals(a, svc.tokenFor("eyJ.access.b"));
        assertFalse(a.contains("="), "base64url without padding");
        assertTrue(svc.isEnforced());
    }

    @Test
    @DisplayName("Another secret earns another token")
    void secretMatters() {
        assertNotEquals(new CsrfTokenService(SECRET, true).tokenFor("t"),
                new CsrfTokenService(SECRET + "x", true).tokenFor("t"));
    }

    @Test
    @DisplayName("matches accepts the issued token and refuses anything else")
    void matches() {
        CsrfTokenService svc = new CsrfTokenService(SECRET, false);
        String token = svc.tokenFor("eyJ.access");
        assertTrue(svc.matches("eyJ.access", token));
        assertTrue(svc.matches("eyJ.access", " " + token + " "));
        assertFalse(svc.matches("eyJ.access", token + "x"));
        assertFalse(svc.matches("eyJ.other", token));
        assertFalse(svc.matches("eyJ.access", null));
        assertFalse(svc.matches("eyJ.access", "  "));
        assertFalse(svc.matches(null, token));
        assertFalse(svc.isEnforced());
    }

    @Test
    @DisplayName("A blank access token earns nothing and a blank secret is refused outright")
    void blanks() {
        CsrfTokenService svc = new CsrfTokenService(SECRET, true);
        assertNull(svc.tokenFor(null));
        assertNull(svc.tokenFor("  "));
        assertThrows(IllegalArgumentException.class, () -> new CsrfTokenService(" ", true));
        assertThrows(IllegalArgumentException.class, () -> new CsrfTokenService(null, true));
    }
}
