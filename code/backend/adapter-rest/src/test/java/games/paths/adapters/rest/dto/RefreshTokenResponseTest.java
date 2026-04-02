package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link RefreshTokenResponse} DTO.
 */
class RefreshTokenResponseTest {

    @Test
    @DisplayName("Should create with no-arg constructor and verify defaults")
    void noArgConstructor() {
        RefreshTokenResponse resp = new RefreshTokenResponse();
        assertNull(resp.getUserUuid());
        assertNull(resp.getUsername());
        assertNull(resp.getRole());
        assertNull(resp.getAccessToken());
        assertNull(resp.getRefreshToken());
        assertEquals(0L, resp.getAccessTokenExpiresAt());
        assertEquals(0L, resp.getRefreshTokenExpiresAt());
    }

    @Test
    @DisplayName("Should create with parameterized constructor")
    void paramConstructor() {
        RefreshTokenResponse resp = new RefreshTokenResponse(
                "u-1", "guest_u1", "PLAYER", "acc-tok", "ref-tok", 1000L, 2000L);

        assertAll(
            () -> assertEquals("u-1", resp.getUserUuid()),
            () -> assertEquals("guest_u1", resp.getUsername()),
            () -> assertEquals("PLAYER", resp.getRole()),
            () -> assertEquals("acc-tok", resp.getAccessToken()),
            () -> assertEquals("ref-tok", resp.getRefreshToken()),
            () -> assertEquals(1000L, resp.getAccessTokenExpiresAt()),
            () -> assertEquals(2000L, resp.getRefreshTokenExpiresAt())
        );
    }

    @Test
    @DisplayName("Should set and get all fields via setters")
    void settersAndGetters() {
        RefreshTokenResponse resp = new RefreshTokenResponse();
        resp.setUserUuid("u-2");
        resp.setUsername("testuser");
        resp.setRole("ADMIN");
        resp.setAccessToken("a-tok");
        resp.setRefreshToken("r-tok");
        resp.setAccessTokenExpiresAt(5000L);
        resp.setRefreshTokenExpiresAt(9000L);

        assertAll(
            () -> assertEquals("u-2", resp.getUserUuid()),
            () -> assertEquals("testuser", resp.getUsername()),
            () -> assertEquals("ADMIN", resp.getRole()),
            () -> assertEquals("a-tok", resp.getAccessToken()),
            () -> assertEquals("r-tok", resp.getRefreshToken()),
            () -> assertEquals(5000L, resp.getAccessTokenExpiresAt()),
            () -> assertEquals(9000L, resp.getRefreshTokenExpiresAt())
        );
    }
}
