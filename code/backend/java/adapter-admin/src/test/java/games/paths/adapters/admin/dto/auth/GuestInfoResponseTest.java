package games.paths.adapters.admin.dto.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GuestInfoResponseTest {

    @Test
    void constructor_and_setters_work() {
        GuestInfoResponse r = new GuestInfoResponse("u1","name","nick","PLAYER",6,"ct","2030-01-01","en","reg","last",false);

        assertEquals("u1", r.getUserUuid());
        assertEquals("name", r.getUsername());
        assertEquals("nick", r.getNickname());
        assertEquals("PLAYER", r.getRole());
        assertEquals(6, r.getState());
        assertEquals("ct", r.getGuestCookieToken());
        assertEquals("2030-01-01", r.getGuestExpiresAt());
        assertEquals("en", r.getLanguage());
        assertEquals("reg", r.getTsRegistration());
        assertEquals("last", r.getTsLastAccess());
        assertFalse(r.isExpired());

        GuestInfoResponse s = new GuestInfoResponse();
        s.setUserUuid("u2");
        s.setUsername("n2");
        s.setNickname("nk");
        s.setRole("R");
        s.setState(1);
        s.setGuestCookieToken("c2");
        s.setGuestExpiresAt("e2");
        s.setLanguage("it");
        s.setTsRegistration("r2");
        s.setTsLastAccess("l2");
        s.setExpired(true);

        assertEquals("u2", s.getUserUuid());
        assertTrue(s.isExpired());
    }
}
