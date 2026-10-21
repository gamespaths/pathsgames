package games.paths.core.service.auth;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests of {@link TokenHasher} and {@link NicknameGenerator} (v1.2.0).
 */
class TokenHasherAndNicknameTest {

    @Test
    void sha256IsLowercaseHex() {
        assertEquals("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", TokenHasher.sha256("hello"));
        assertNull(TokenHasher.sha256(null));
    }

    @Test
    void legacyFallbackEndsAfterTheWindow() {
        assertEquals("clear", TokenHasher.legacy("clear", Instant.parse("2026-11-01T00:00:00Z")));
        assertNull(TokenHasher.legacy("clear", TokenHasher.LEGACY_FALLBACK_UNTIL));
    }

    @Test
    void baseFromEmail() {
        assertEquals("mario.rossi", NicknameGenerator.base("Mario.Rossi+games@gmail.com"));
        assertEquals("mario", NicknameGenerator.base("mario"));
        assertEquals("player", NicknameGenerator.base(null));
        assertEquals("player", NicknameGenerator.base("+tag@gmail.com"));
        String longLocal = "a".repeat(120) + "@gmail.com";
        assertEquals(NicknameGenerator.MAX_LENGTH, NicknameGenerator.base(longLocal).length());
    }

    @Test
    void candidatesAndFirstFree() {
        assertEquals("mario", NicknameGenerator.candidate("mario", 1));
        assertEquals("mario#3", NicknameGenerator.candidate("mario", 3));
        Set<String> taken = Set.of("mario", "mario#2");
        assertEquals("mario#3", NicknameGenerator.firstFree("mario", 1, taken::contains, "12345678-x"));
        assertEquals("mario#4", NicknameGenerator.firstFree("mario", 4, taken::contains, "12345678-x"));
        assertEquals("mario", NicknameGenerator.firstFree("mario", 0, n -> false, "12345678-x"));
        assertEquals("mario#12345678", NicknameGenerator.firstFree("mario", 1, n -> true, "12345678-x"));
    }
}
