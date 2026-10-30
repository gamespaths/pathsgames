package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** v1.7.0 users.sessions_valid_after read as epoch seconds by the user status mapping. */
class IdentityStatusMappingTest {

    @Test
    void epochSecondsOfTheValidAfterColumn() {
        assertEquals(0L, IdentityPersistenceAdapter.epochSeconds(null));
        assertEquals(0L, IdentityPersistenceAdapter.epochSeconds(" "));
        assertEquals(0L, IdentityPersistenceAdapter.epochSeconds("not-a-date"));
        assertEquals(1_792_663_200L, IdentityPersistenceAdapter.epochSeconds("2026-10-22T10:00:00Z"));
    }

    @Test
    void statusCarriesTheValue() {
        UserEntity u = new UserEntity();
        u.setId(1L);
        u.setUuid("u");
        u.setSessionsValidAfter("2026-10-22T10:00:00Z");
        assertEquals(1_792_663_200L, IdentityPersistenceAdapter.toStatus(u).sessionsValidAfter());
        assertEquals("2026-10-22T10:00:00Z", u.getSessionsValidAfter());
    }
}
