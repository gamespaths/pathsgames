package games.paths.core.model.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the {@link GuestInfo} record.
 * Covers canonical-constructor validation and field mapping.
 */
class GuestInfoTest {

    private static final String VALID_UUID = "u1";
    private static final String VALID_USER = "guest";

    private GuestInfo guest(String userUuid, String username) {
        return new GuestInfo(userUuid, username, "nick42", "GUEST", 2,
                "ct42", "2030-01-01T00:00:00Z", "it",
                "2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", true);
    }

    @Nested
    @DisplayName("Field Mapping Tests")
    class MappingTests {

        @Test
        @DisplayName("Canonical constructor maps all components")
        void allAccessors_returnCorrectValues() {
            GuestInfo g = guest("uuid42", "g42");
            assertAll(
                () -> assertEquals("uuid42", g.userUuid()),
                () -> assertEquals("g42", g.username()),
                () -> assertEquals("nick42", g.nickname()),
                () -> assertEquals("GUEST", g.role()),
                () -> assertEquals(2, g.state()),
                () -> assertEquals("ct42", g.guestCookieToken()),
                () -> assertEquals("2030-01-01T00:00:00Z", g.guestExpiresAt()),
                () -> assertEquals("it", g.language()),
                () -> assertEquals("2024-01-01T00:00:00Z", g.tsRegistration()),
                () -> assertEquals("2024-01-02T00:00:00Z", g.tsLastAccess()),
                () -> assertTrue(g.expired())
            );
        }

        @Test
        @DisplayName("Optional fields may be null, primitives keep their values")
        void optionalFields() {
            GuestInfo g = new GuestInfo(VALID_UUID, VALID_USER, null, null, 0,
                    null, null, null, null, null, false);
            assertNull(g.nickname());
            assertEquals(0, g.state());
            assertFalse(g.expired());
            assertNull(g.guestCookieToken());
        }
    }

    @Nested
    @DisplayName("Constructor Validation Tests")
    class ValidationTests {

        @Test
        @DisplayName("Throws when userUuid is null, empty or blank")
        void validateUserUuid() {
            assertThrows(IllegalArgumentException.class, () -> guest(null, VALID_USER));
            assertThrows(IllegalArgumentException.class, () -> guest("", VALID_USER));
            assertThrows(IllegalArgumentException.class, () -> guest("   ", VALID_USER));
        }

        @Test
        @DisplayName("Throws when username is null or blank")
        void validateUsername() {
            assertThrows(IllegalArgumentException.class, () -> guest(VALID_UUID, null));
            assertThrows(IllegalArgumentException.class, () -> guest(VALID_UUID, " "));
        }
    }

    @Test
    @DisplayName("equals/hashCode follow record value semantics")
    void valueSemantics() {
        assertEquals(guest("u", "n"), guest("u", "n"));
        assertEquals(guest("u", "n").hashCode(), guest("u", "n").hashCode());
    }
}
