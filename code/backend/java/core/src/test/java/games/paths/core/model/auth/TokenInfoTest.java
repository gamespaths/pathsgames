package games.paths.core.model.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link TokenInfo} model.
 * Covers builder validation and all accessor methods.
 */
class TokenInfoTest {

    @Nested
    @DisplayName("Builder Validation Tests")
    class BuilderValidation {

        @Test
        @DisplayName("Should build TokenInfo with all fields set")
        void build_allFields() {
            TokenInfo info = TokenInfo.builder()
                    .userUuid("u-123")
                    .username("testuser")
                    .role("PLAYER")
                    .type("access")
                    .tokenId("jti-abc")
                    .issuedAt(1000L)
                    .expiresAt(2000L)
                    .build();

            assertAll(
                () -> assertEquals("u-123", info.getUserUuid()),
                () -> assertEquals("testuser", info.getUsername()),
                () -> assertEquals("PLAYER", info.getRole()),
                () -> assertEquals("access", info.getType()),
                () -> assertEquals("jti-abc", info.getTokenId()),
                () -> assertEquals(1000L, info.getIssuedAt()),
                () -> assertEquals(2000L, info.getExpiresAt())
            );
        }

        @Test
        @DisplayName("Should throw when userUuid is null")
        void build_nullUserUuid() {
            assertThrows(IllegalStateException.class, () ->
                    TokenInfo.builder().username("u").build());
        }

        @Test
        @DisplayName("Should throw when userUuid is blank")
        void build_blankUserUuid() {
            assertThrows(IllegalStateException.class, () ->
                    TokenInfo.builder().userUuid("  ").build());
        }

        @Test
        @DisplayName("Should build with only userUuid set (minimal)")
        void build_minimalFields() {
            TokenInfo info = TokenInfo.builder()
                    .userUuid("u-123")
                    .build();

            assertNotNull(info);
            assertEquals("u-123", info.getUserUuid());
            assertNull(info.getUsername());
        }
    }

    @Nested
    @DisplayName("Accessor / Convenience Tests")
    class Accessors {

        @Test
        @DisplayName("isAccessToken returns true for type=access")
        void isAccessToken_true() {
            TokenInfo info = TokenInfo.builder().userUuid("u").type("access").build();
            assertTrue(info.isAccessToken());
            assertFalse(info.isRefreshToken());
        }

        @Test
        @DisplayName("isRefreshToken returns true for type=refresh")
        void isRefreshToken_true() {
            TokenInfo info = TokenInfo.builder().userUuid("u").type("refresh").build();
            assertTrue(info.isRefreshToken());
            assertFalse(info.isAccessToken());
        }

        @Test
        @DisplayName("isAdmin returns true for role=ADMIN")
        void isAdmin_true() {
            TokenInfo info = TokenInfo.builder().userUuid("u").role("ADMIN").build();
            assertTrue(info.isAdmin());
        }

        @Test
        @DisplayName("isAdmin returns false for role=PLAYER")
        void isAdmin_false() {
            TokenInfo info = TokenInfo.builder().userUuid("u").role("PLAYER").build();
            assertFalse(info.isAdmin());
        }

        @Test
        @DisplayName("isAdmin returns false for null role")
        void isAdmin_nullRole() {
            TokenInfo info = TokenInfo.builder().userUuid("u").build();
            assertFalse(info.isAdmin());
        }

        @Test
        @DisplayName("isAccessToken returns false for null type")
        void isAccessToken_nullType() {
            TokenInfo info = TokenInfo.builder().userUuid("u").build();
            assertFalse(info.isAccessToken());
        }

        @Test
        @DisplayName("toString contains userUuid and username")
        void toString_containsFields() {
            TokenInfo info = TokenInfo.builder()
                    .userUuid("u-123").username("test").role("PLAYER").type("access").build();
            String str = info.toString();
            assertTrue(str.contains("u-123"));
            assertTrue(str.contains("test"));
        }
    }
}
