package games.paths.adapters.rest.controller.auth;

import org.junit.jupiter.api.Test;

import games.paths.adapters.rest.dto.GuestLoginResponse;

import static org.junit.jupiter.api.Assertions.*;

class GuestLoginResponseTest {

    @Test
    void constructor_and_setters_work() {
        GuestLoginResponse r = new GuestLoginResponse("u1", "guest", "a", "r", 1000L, 2000L, "cookie");

        assertEquals("u1", r.getUserUuid());
        assertEquals("guest", r.getUsername());
        assertEquals("a", r.getAccessToken());
        assertEquals("r", r.getRefreshToken());
        assertEquals(1000L, r.getAccessTokenExpiresAt());
        assertEquals(2000L, r.getRefreshTokenExpiresAt());
        assertEquals("cookie", r.getGuestCookieToken());

        GuestLoginResponse s = new GuestLoginResponse();
        s.setUserUuid("u2");
        s.setUsername("g2");
        s.setAccessToken("ax");
        s.setRefreshToken("rx");
        s.setAccessTokenExpiresAt(11L);
        s.setRefreshTokenExpiresAt(22L);
        s.setGuestCookieToken("c2");

        assertEquals("u2", s.getUserUuid());
        assertEquals("g2", s.getUsername());
        assertEquals("ax", s.getAccessToken());
        assertEquals("rx", s.getRefreshToken());
        assertEquals(11L, s.getAccessTokenExpiresAt());
        assertEquals(22L, s.getRefreshTokenExpiresAt());
        assertEquals("c2", s.getGuestCookieToken());
    }
}
