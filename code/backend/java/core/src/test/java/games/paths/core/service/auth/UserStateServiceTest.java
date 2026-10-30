package games.paths.core.service.auth;

import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.IdentityPersistencePort;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests of {@link UserStateService}: one query per user per 60 s, eviction at a state change.
 */
class UserStateServiceTest {

    private final AtomicLong millis = new AtomicLong(1_000_000L);
    private final Clock clock = new Clock() {
        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(millis.get());
        }
    };

    @Test
    void cachesFor60Seconds() {
        IdentityPersistencePort port = mock(IdentityPersistencePort.class);
        UserStatus user = new UserStatus(1, "u", "n", "n", "PLAYER", 2, "en");
        when(port.findUserByUuid("u")).thenReturn(Optional.of(user));
        UserStateService service = new UserStateService(port, 60_000L, clock);

        assertEquals(user, service.current("u").orElseThrow());
        millis.addAndGet(59_000);
        service.current("u");
        verify(port, times(1)).findUserByUuid("u");
        millis.addAndGet(2_000);
        service.current("u");
        verify(port, times(2)).findUserByUuid("u");
    }

    @Test
    void evictForcesAReload() {
        IdentityPersistencePort port = mock(IdentityPersistencePort.class);
        when(port.findUserByUuid("u")).thenReturn(Optional.empty());
        UserStateService service = new UserStateService(port);
        assertTrue(service.current("u").isEmpty());
        assertTrue(service.current("u").isEmpty());
        service.evict("u");
        service.evict(null);
        service.current("u");
        verify(port, times(2)).findUserByUuid("u");
    }

    @Test
    void blankUuidIsEmpty() {
        UserStateService service = new UserStateService(mock(IdentityPersistencePort.class));
        assertTrue(service.current(null).isEmpty());
        assertTrue(service.current(" ").isEmpty());
    }

    @Test
    void sweepsExpiredEntriesAboveTheThreshold() {
        IdentityPersistencePort port = mock(IdentityPersistencePort.class);
        when(port.findUserByUuid(anyString())).thenReturn(Optional.empty());
        UserStateService service = new UserStateService(port, 10L, clock);
        for (int i = 0; i < 10_002; i++) {
            service.current("u" + i);
        }
        millis.addAndGet(20);
        service.current("last");
        verify(port, atLeast(10_003)).findUserByUuid(anyString());
    }
}
