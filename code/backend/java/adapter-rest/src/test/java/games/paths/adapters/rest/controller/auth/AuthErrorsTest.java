package games.paths.adapters.rest.controller.auth;

import games.paths.core.model.auth.AuthException;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** AuthErrors (v1.7.0): a suspended login names the end of the suspension, other errors do not. */
class AuthErrorsTest {

    @Test
    void suspendedUntilIsAddedOnlyWhenPresent() {
        ResponseEntity<Object> suspended = AuthErrors.of(new AuthException(AuthException.Code.ACCOUNT_DISABLED,
                "suspended", "2026-11-01T00:00:00Z"));
        assertEquals(403, suspended.getStatusCode().value());
        assertEquals("2026-11-01T00:00:00Z", ((Map<?, ?>) suspended.getBody()).get("suspendedUntil"));
        ResponseEntity<Object> plain = AuthErrors.of(new AuthException(AuthException.Code.ACCOUNT_DISABLED, "x"));
        assertFalse(((Map<?, ?>) plain.getBody()).containsKey("suspendedUntil"));
    }
}
