package games.paths.core.model.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the {@link TokenInfo} record.
 * Covers canonical-constructor validation and the convenience predicates.
 */
class TokenInfoTest {

    private TokenInfo token(String userUuid, String role, String type) {
        return new TokenInfo(userUuid, "testuser", role, type, "jti-abc", 1000L, 2000L);
    }

    @Nested
    @DisplayName("Construction and Validation")
    class Construction {

        @Test
        @DisplayName("Canonical constructor maps all components")
        void constructor_allFields() {
            TokenInfo info = token("u-123", "PLAYER", "access");
            assertAll(
                () -> assertEquals("u-123", info.userUuid()),
                () -> assertEquals("testuser", info.username()),
                () -> assertEquals("PLAYER", info.role()),
                () -> assertEquals("access", info.type()),
                () -> assertEquals("jti-abc", info.tokenId()),
                () -> assertEquals(1000L, info.issuedAt()),
                () -> assertEquals(2000L, info.expiresAt())
            );
        }

        @Test
        @DisplayName("Throws when userUuid is null or blank")
        void constructor_invalidUserUuid() {
            assertThrows(IllegalStateException.class, () -> token(null, "PLAYER", "access"));
            assertThrows(IllegalStateException.class, () -> token("  ", "PLAYER", "access"));
        }
    }

    @Nested
    @DisplayName("Convenience predicates")
    class Predicates {

        @Test
        @DisplayName("isAccessToken / isRefreshToken reflect the type")
        void tokenTypePredicates() {
            assertTrue(token("u", "PLAYER", "access").isAccessToken());
            assertFalse(token("u", "PLAYER", "access").isRefreshToken());
            assertTrue(token("u", "PLAYER", "refresh").isRefreshToken());
            assertFalse(token("u", "PLAYER", "refresh").isAccessToken());
            assertFalse(token("u", "PLAYER", null).isAccessToken());
        }

        @Test
        @DisplayName("isAdmin true only for role ADMIN")
        void isAdmin() {
            assertTrue(token("u", "ADMIN", "access").isAdmin());
            assertFalse(token("u", "PLAYER", "access").isAdmin());
            assertFalse(token("u", null, "access").isAdmin());
        }
    }
}
