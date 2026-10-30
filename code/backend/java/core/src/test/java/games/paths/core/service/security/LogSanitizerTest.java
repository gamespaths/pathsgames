package games.paths.core.service.security;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests of {@link LogSanitizer} (v1.2.0): personal keys and email addresses never reach a log line.
 */
class LogSanitizerTest {

    @Test
    void mapValuesAreRedacted() {
        Map<String, Object> out = LogSanitizer.sanitize(Map.of("email", "a@gmail.com", "given_name", "Mario",
                "family_name", "Rossi", "name", "Mario Rossi", "picture", "https://lh3/p", "sub", "123",
                "nested", Map.of("pictureUrl", "x", "note", "write to b@gmail.com"),
                "list", List.of(Map.of("emailAddress", "c@gmail.com"), 5)));
        assertEquals(LogSanitizer.REDACTED, out.get("email"));
        assertEquals(LogSanitizer.REDACTED, out.get("given_name"));
        assertEquals(LogSanitizer.REDACTED, out.get("family_name"));
        assertEquals(LogSanitizer.REDACTED, out.get("name"));
        assertEquals(LogSanitizer.REDACTED, out.get("picture"));
        assertEquals("123", out.get("sub"));
        @SuppressWarnings("unchecked")
        Map<String, Object> nested = (Map<String, Object>) out.get("nested");
        assertEquals(LogSanitizer.REDACTED, nested.get("pictureUrl"));
        assertEquals("write to " + LogSanitizer.REDACTED, nested.get("note"));
        assertEquals(LogSanitizer.REDACTED, ((Map<?, ?>) ((List<?>) out.get("list")).get(0)).get("emailAddress"));
        assertEquals(5, ((List<?>) out.get("list")).get(1));
        assertTrue(LogSanitizer.sanitize((Map<String, ?>) null).isEmpty());
    }

    @Test
    void textPairsAndEmailsAreRedacted() {
        String out = LogSanitizer.sanitize("{\"email\": \"a@gmail.com\", \"sub\": \"1\", given_name=Mario, name='M R'}");
        assertFalse(out.contains("a@gmail.com"));
        assertFalse(out.contains("Mario"));
        assertFalse(out.contains("M R"));
        assertTrue(out.contains("\"sub\": \"1\""));
        assertEquals("user " + LogSanitizer.REDACTED + " logged", LogSanitizer.sanitize("user x.y@gmail.com logged"));
        assertNull(LogSanitizer.sanitize((String) null));
    }

    @Test
    void keysAndLists() {
        assertTrue(LogSanitizer.isSensitiveKey("Email"));
        assertFalse(LogSanitizer.isSensitiveKey(null));
        assertFalse(LogSanitizer.isSensitiveKey("nickname"));
        assertEquals(1, LogSanitizer.sanitizeAll(List.of(Map.of("name", "x"))).size());
        assertTrue(LogSanitizer.sanitizeAll(null).isEmpty());
    }
}
