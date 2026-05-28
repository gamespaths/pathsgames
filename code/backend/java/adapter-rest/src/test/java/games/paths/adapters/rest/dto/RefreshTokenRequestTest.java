package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link RefreshTokenRequest} DTO.
 */
class RefreshTokenRequestTest {

    @Test
    @DisplayName("Should create with no-arg constructor and set via setter")
    void noArgConstructor() {
        RefreshTokenRequest req = new RefreshTokenRequest();
        assertNull(req.getRefreshToken());

        req.setRefreshToken("tok-123");
        assertEquals("tok-123", req.getRefreshToken());
    }

    @Test
    @DisplayName("Should create with parameterized constructor")
    void paramConstructor() {
        RefreshTokenRequest req = new RefreshTokenRequest("refresh-tok");
        assertEquals("refresh-tok", req.getRefreshToken());
    }
}
