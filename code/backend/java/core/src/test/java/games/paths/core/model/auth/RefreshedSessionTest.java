package games.paths.core.model.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link RefreshedSession} model.
 * Covers builder validation and all accessor methods.
 */
class RefreshedSessionTest {

    @Nested
    @DisplayName("Builder Validation Tests")
    class BuilderValidation {

        @Test
        @DisplayName("Should build RefreshedSession with all fields set")
        void build_allFields() {
            RefreshedSession session = RefreshedSession.builder()
                    .userUuid("u-123")
                    .username("testuser")
                    .role("PLAYER")
                    .accessToken("access-token")
                    .refreshToken("refresh-token")
                    .accessTokenExpiresAt(1000L)
                    .refreshTokenExpiresAt(2000L)
                    .build();

            assertAll(
                () -> assertEquals("u-123", session.getUserUuid()),
                () -> assertEquals("testuser", session.getUsername()),
                () -> assertEquals("PLAYER", session.getRole()),
                () -> assertEquals("access-token", session.getAccessToken()),
                () -> assertEquals("refresh-token", session.getRefreshToken()),
                () -> assertEquals(1000L, session.getAccessTokenExpiresAt()),
                () -> assertEquals(2000L, session.getRefreshTokenExpiresAt())
            );
        }

        @Test
        @DisplayName("Should throw when userUuid is null")
        void build_nullUserUuid() {
            assertThrows(IllegalStateException.class, () ->
                    RefreshedSession.builder()
                            .accessToken("tok")
                            .build());
        }

        @Test
        @DisplayName("Should throw when userUuid is blank")
        void build_blankUserUuid() {
            assertThrows(IllegalStateException.class, () ->
                    RefreshedSession.builder()
                            .userUuid("  ")
                            .accessToken("tok")
                            .build());
        }

        @Test
        @DisplayName("Should throw when accessToken is null")
        void build_nullAccessToken() {
            assertThrows(IllegalStateException.class, () ->
                    RefreshedSession.builder()
                            .userUuid("u-123")
                            .build());
        }

        @Test
        @DisplayName("Should throw when accessToken is blank")
        void build_blankAccessToken() {
            assertThrows(IllegalStateException.class, () ->
                    RefreshedSession.builder()
                            .userUuid("u-123")
                            .accessToken("  ")
                            .build());
        }
    }

    @Nested
    @DisplayName("Accessor Tests")
    class Accessors {

        @Test
        @DisplayName("toString contains userUuid and username")
        void toString_containsFields() {
            RefreshedSession session = RefreshedSession.builder()
                    .userUuid("u-123")
                    .username("test")
                    .accessToken("tok")
                    .build();
            String str = session.toString();
            assertTrue(str.contains("u-123"));
            assertTrue(str.contains("test"));
        }

        @Test
        @DisplayName("Should allow null refreshToken (minimal build)")
        void build_nullRefreshToken() {
            RefreshedSession session = RefreshedSession.builder()
                    .userUuid("u-123")
                    .accessToken("tok")
                    .build();
            assertNull(session.getRefreshToken());
        }
    }
}
