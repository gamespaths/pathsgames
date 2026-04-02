package games.paths.adapters.rest.controller.auth;

import org.junit.jupiter.api.Test;

import games.paths.adapters.rest.dto.GuestLoginResponse;

import static org.junit.jupiter.api.Assertions.*;

class GuestLoginResponseTest {

    @Test
    void constructor_and_setters_work() {
        // Since v0.13.0-httponly: refreshToken and guestCookieToken are HttpOnly cookies,
        // no longer part of the JSON response body.
        GuestLoginResponse r = new GuestLoginResponse("u1", "guest", "a", 1000L, 2000L);

        assertEquals("u1", r.getUserUuid());
        assertEquals("guest", r.getUsername());
        assertEquals("a", r.getAccessToken());
        assertEquals(1000L, r.getAccessTokenExpiresAt());
        assertEquals(2000L, r.getRefreshTokenExpiresAt());

        GuestLoginResponse s = new GuestLoginResponse();
        s.setUserUuid("u2");
        s.setUsername("g2");
        s.setAccessToken("ax");
        s.setAccessTokenExpiresAt(11L);
        s.setRefreshTokenExpiresAt(22L);

        assertEquals("u2", s.getUserUuid());
        assertEquals("g2", s.getUsername());
        assertEquals("ax", s.getAccessToken());
        assertEquals(11L, s.getAccessTokenExpiresAt());
        assertEquals(22L, s.getRefreshTokenExpiresAt());
    }
}
