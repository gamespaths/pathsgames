package games.paths.core.model.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link BaseSession} shared fields.
 * Uses {@link GuestSession} and {@link RefreshedSession} as concrete implementations.
 */
class BaseSessionTest {

    @Test
    @DisplayName("GuestSession inherits all BaseSession getters")
    void guestSessionInherits() {
        GuestSession s = GuestSession.builder()
                .userUuid("u1")
                .username("guest")
                .accessToken("at")
                .refreshToken("rt")
                .accessTokenExpiresAt(100L)
                .refreshTokenExpiresAt(200L)
                .guestCookieToken("cookie")
                .build();

        assertAll(
            () -> assertEquals("u1", s.getUserUuid()),
            () -> assertEquals("guest", s.getUsername()),
            () -> assertEquals("at", s.getAccessToken()),
            () -> assertEquals("rt", s.getRefreshToken()),
            () -> assertEquals(100L, s.getAccessTokenExpiresAt()),
            () -> assertEquals(200L, s.getRefreshTokenExpiresAt()),
            () -> assertEquals("cookie", s.getGuestCookieToken())
        );
    }

    @Test
    @DisplayName("RefreshedSession inherits all BaseSession getters")
    void refreshedSessionInherits() {
        RefreshedSession s = RefreshedSession.builder()
                .userUuid("u2")
                .username("player")
                .role("ADMIN")
                .accessToken("at2")
                .refreshToken("rt2")
                .accessTokenExpiresAt(300L)
                .refreshTokenExpiresAt(400L)
                .build();

        assertAll(
            () -> assertEquals("u2", s.getUserUuid()),
            () -> assertEquals("player", s.getUsername()),
            () -> assertEquals("ADMIN", s.getRole()),
            () -> assertEquals("at2", s.getAccessToken()),
            () -> assertEquals("rt2", s.getRefreshToken()),
            () -> assertEquals(300L, s.getAccessTokenExpiresAt()),
            () -> assertEquals(400L, s.getRefreshTokenExpiresAt())
        );
    }

    @Test
    @DisplayName("Builder fluent chaining works for both session types")
    void builderChaining() {
        // Verify builder methods from BaseBuilder return correct type for chaining
        GuestSession gs = GuestSession.builder()
                .userUuid("u").username("g").accessToken("t")
                .refreshToken("r").accessTokenExpiresAt(1).refreshTokenExpiresAt(2)
                .guestCookieToken("c")
                .build();
        assertNotNull(gs);

        RefreshedSession rs = RefreshedSession.builder()
                .userUuid("u").username("p").accessToken("t")
                .refreshToken("r").accessTokenExpiresAt(1).refreshTokenExpiresAt(2)
                .role("R")
                .build();
        assertNotNull(rs);
    }
}
