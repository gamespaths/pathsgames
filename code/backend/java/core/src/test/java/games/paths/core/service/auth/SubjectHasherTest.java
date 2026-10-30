package games.paths.core.service.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** v1.11.0 {@link SubjectHasher}: stable hex HMAC, email normalised, blank input null, missing algorithm. */
class SubjectHasherTest {

    @Test
    @DisplayName("Same input same hash, email trimmed and lowercased, blank values hash to null")
    void hashes() {
        SubjectHasher hasher = new SubjectHasher("pepper");
        assertEquals(hasher.subject("sub-1"), new SubjectHasher("pepper").subject("sub-1"));
        assertNotEquals(hasher.subject("sub-1"), new SubjectHasher("other").subject("sub-1"));
        assertEquals(hasher.email("mario@gmail.com"), hasher.email("  Mario@Gmail.com "));
        assertEquals(64, hasher.subject("sub-1").length());
        assertNull(hasher.email(" "));
        assertNull(hasher.email(null));
        assertEquals(new SubjectHasher(SubjectHasher.DEFAULT_PEPPER).subject("s"), new SubjectHasher(" ").subject("s"));
    }

    @Test
    @DisplayName("An unknown HMAC algorithm is an IllegalStateException naming it")
    void unavailableAlgorithm() {
        SubjectHasher hasher = new SubjectHasher("pepper");
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> hasher.hmac("x", "NoSuchMac"));
        assertTrue(e.getMessage().contains("NoSuchMac"));
    }
}
