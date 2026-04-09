package games.paths.core.model.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link GuestInfo}.
 * Focuses on builder validation, field mapping, and branch coverage for required fields.
 */
@ExtendWith(MockitoExtension.class) // Abilita l'integrazione con Mockito
class GuestInfoTest {

    private static final String VALID_UUID = "u1";
    private static final String VALID_USER = "guest";

    // --- GRUPPO TEST MAPPATURA ---

    @Nested
    @DisplayName("Field Mapping Tests")
    class MappingTests {

        @Test
        @DisplayName("Should correctly map all provided fields via Builder")
        void allGetters_returnCorrectValues() {
            // Act
            GuestInfo g = GuestInfo.builder()
                    .userUuid("uuid42")
                    .username("g42")
                    .nickname("nick42")
                    .role("GUEST")
                    .state(2)
                    .guestCookieToken("ct42")
                    .guestExpiresAt("2030-01-01T00:00:00Z")
                    .language("it")
                    .tsRegistration("2024-01-01T00:00:00Z")
                    .tsLastAccess("2024-01-02T00:00:00Z")
                    .expired(true)
                    .build();

            // Assert
            assertAll("Verify all GuestInfo properties",
                () -> assertEquals("uuid42", g.getUserUuid()),
                () -> assertEquals("g42", g.getUsername()),
                () -> assertEquals("nick42", g.getNickname()),
                () -> assertEquals("GUEST", g.getRole()),
                () -> assertEquals(2, g.getState()),
                () -> assertEquals("ct42", g.getGuestCookieToken()),
                () -> assertEquals("2030-01-01T00:00:00Z", g.getGuestExpiresAt()),
                () -> assertEquals("it", g.getLanguage()),
                () -> assertEquals("2024-01-01T00:00:00Z", g.getTsRegistration()),
                () -> assertEquals("2024-01-02T00:00:00Z", g.getTsLastAccess()),
                () -> assertTrue(g.isExpired())
            );
        }

        @Test
        @DisplayName("Should ensure optional fields are null and primitives have defaults")
        void optionalFields_and_defaults() {
            // Act
            GuestInfo g = GuestInfo.builder()
                    .userUuid(VALID_UUID)
                    .username(VALID_USER)
                    .build();

            // Assert
            assertAll("Check defaults for non-provided fields",
                () -> assertNull(g.getNickname()),
                () -> assertEquals(0, g.getState()), // Default primitivo int
                () -> assertFalse(g.isExpired()),   // Default primitivo boolean
                () -> assertNull(g.getGuestCookieToken())
            );
        }
    }

    // --- GRUPPO TEST VALIDAZIONE (BRANCH COVERAGE) ---

    @Nested
    @DisplayName("Builder Validation Tests (Branch Coverage)")
    class ValidationTests {

        @Test
        @DisplayName("Should throw exception if userUuid is null, empty or blank")
        void validateUserUuid_Branches() {
            // Branch: userUuid == null
            assertThrows(IllegalArgumentException.class, () -> 
                GuestInfo.builder().username(VALID_USER).build());

            // Branch: userUuid.isBlank() (Empty)
            assertThrows(IllegalArgumentException.class, () -> 
                GuestInfo.builder().userUuid("").username(VALID_USER).build());

            // Branch: userUuid.isBlank() (Spaces)
            assertThrows(IllegalArgumentException.class, () -> 
                GuestInfo.builder().userUuid("   ").username(VALID_USER).build());
        }

        @Test
        @DisplayName("Should throw exception if username is null, empty or blank")
        void validateUsername_Branches() {
            // Branch: username == null
            assertThrows(IllegalArgumentException.class, () -> 
                GuestInfo.builder().userUuid(VALID_UUID).build());

            // Branch: username.isBlank()
            assertThrows(IllegalArgumentException.class, () -> 
                GuestInfo.builder().userUuid(VALID_UUID).username(" ").build());
        }
    }

    @Test
    @DisplayName("Should successfully build with only required fields")
    void build_withRequiredOnly() {
        GuestInfo g = GuestInfo.builder()
                .userUuid(VALID_UUID)
                .username(VALID_USER)
                .build();
        
        assertNotNull(g);
        assertEquals(VALID_UUID, g.getUserUuid());
    }
}