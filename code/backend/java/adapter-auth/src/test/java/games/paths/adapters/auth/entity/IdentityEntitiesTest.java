package games.paths.adapters.auth.entity;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests of the v1.2.0 entities: users_identities, auth_id_token_seen, users_tokens.ts_rotated.
 */
class IdentityEntitiesTest {

    @Test
    void identityEntity() {
        UserIdentityEntity e = new UserIdentityEntity();
        e.setId(1L);
        e.setIdUser(2L);
        e.setProvider("GOOGLE");
        e.setProviderSubject("sub");
        e.setEmail("m@gmail.com");
        e.setProfileName("Mario Rossi");
        e.setGivenName("Mario");
        e.setFamilyName("Rossi");
        e.setPictureUrl("pic");
        e.setLocale("it");
        e.setTsProfileUpdate("t");
        e.onCreate();
        assertEquals(1L, e.getId());
        assertEquals(2L, e.getIdUser());
        assertEquals("GOOGLE", e.getProvider());
        assertEquals("sub", e.getProviderSubject());
        assertEquals("m@gmail.com", e.getEmail());
        assertEquals("Mario Rossi", e.getProfileName());
        assertEquals("Mario", e.getGivenName());
        assertEquals("Rossi", e.getFamilyName());
        assertEquals("pic", e.getPictureUrl());
        assertEquals("it", e.getLocale());
        assertEquals("t", e.getTsProfileUpdate());
        assertNotNull(e.getUuid());
        assertNotNull(e.getTsInsert());
        assertFalse(e.toString().contains("m@gmail.com"));
        String uuid = e.getUuid();
        e.onCreate();
        assertEquals(uuid, e.getUuid());
    }

    @Test
    void seenEntity() {
        IdTokenSeenEntity e = new IdTokenSeenEntity("hash", "2030-01-01T00:00:00Z");
        assertEquals("hash", e.getTokenHash());
        assertEquals("2030-01-01T00:00:00Z", e.getExpiresAt());
        assertNotNull(e.getTsInsert());
        assertNull(new IdTokenSeenEntity().getTokenHash());
    }

    @Test
    void tokenRotation() {
        UserTokenEntity t = new UserTokenEntity();
        t.setTsRotated("now");
        assertEquals("now", t.getTsRotated());
    }
}
