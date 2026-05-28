package games.paths.core.model.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link GuestSession}.
 * Validates the builder logic, mandatory fields, and state consistency.
 */
@ExtendWith(MockitoExtension.class)
class GuestSessionTest {

    private static final String VALID_UUID = "u1";
    private static final String VALID_USER = "guest";
    private static final String VALID_TOKEN = "token-123";

    /**
     * Helper to create a builder pre-populated with all mandatory fields.
     */
    private GuestSession.Builder createValidBuilder() {
        return GuestSession.builder()
                .userUuid(VALID_UUID)
                .username(VALID_USER)
                .accessToken(VALID_TOKEN);
    }

    // --- GRUPPO TEST COSTRUZIONE ---

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields correctly")
        void build_Success() {
            // Act
            GuestSession session = createValidBuilder()
                    .refreshToken("ref-123")
                    .accessTokenExpiresAt(1000L)
                    .refreshTokenExpiresAt(2000L)
                    .guestCookieToken("cookie-abc")
                    .build();

            // Assert
            assertAll("Verify GuestSession state",
                () -> assertEquals(VALID_UUID, session.getUserUuid()),
                () -> assertEquals(VALID_USER, session.getUsername()),
                () -> assertEquals(VALID_TOKEN, session.getAccessToken()),
                () -> assertEquals("ref-123", session.getRefreshToken()),
                () -> assertEquals(1000L, session.getAccessTokenExpiresAt()),
                () -> assertEquals(2000L, session.getRefreshTokenExpiresAt()),
                () -> assertEquals("cookie-abc", session.getGuestCookieToken()),
                () -> assertTrue(session.toString().contains(VALID_UUID))
            );
        }

        @Test
        @DisplayName("Should allow null or empty for optional fields (refreshToken, cookie)")
        void build_OptionalFields() {
            // Act
            GuestSession session = createValidBuilder()
                    .refreshToken(null)
                    .guestCookieToken("")
                    .build();

            // Assert
            assertNull(session.getRefreshToken());
            assertEquals("", session.getGuestCookieToken());
        }
    }

    // --- GRUPPO TEST VALIDAZIONE (BRANCH COVERAGE) ---

    @Nested
    @DisplayName("Builder Validation Tests")
    class ValidationTests {

        @Test
        @DisplayName("Should throw IllegalStateException for invalid userUuid (null/empty/blank)")
        void validateUserUuid_Branches() {
            // Branch: null
            assertThrows(IllegalStateException.class, () -> 
                GuestSession.builder().username(VALID_USER).accessToken(VALID_TOKEN).build());
            
            // Branch: empty/blank
            assertThrows(IllegalStateException.class, () -> 
                createValidBuilder().userUuid("").build());
            
            assertThrows(IllegalStateException.class, () -> 
                createValidBuilder().userUuid("   ").build());
        }

        @Test
        @DisplayName("Should throw IllegalStateException for invalid username (null/empty/blank)")
        void validateUsername_Branches() {
            // Branch: null
            assertThrows(IllegalStateException.class, () -> 
                createValidBuilder().username(null).build());

            // Branch: empty/blank
            assertThrows(IllegalStateException.class, () -> 
                createValidBuilder().username("").build());
            
            assertThrows(IllegalStateException.class, () -> 
                createValidBuilder().username(" ").build());
        }

        @Test
        @DisplayName("Should throw IllegalStateException for invalid accessToken (null/empty/blank)")
        void validateAccessToken_Branches() {
            // Branch: null
            assertThrows(IllegalStateException.class, () -> 
                createValidBuilder().accessToken(null).build());

            // Branch: empty/blank
            assertThrows(IllegalStateException.class, () -> 
                createValidBuilder().accessToken("").build());
        }
    }
}