package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.core.port.match.UserAccessPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserAccessAdapterTest {

    private UserRepository userRepository;
    private UserAccessAdapter adapter;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        adapter = new UserAccessAdapter(userRepository);
    }

    @Test
    void findByUuid_blankReturnsEmpty() {
        assertTrue(adapter.findByUuid(null).isEmpty());
        assertTrue(adapter.findByUuid("  ").isEmpty());
        verifyNoInteractions(userRepository);
    }

    @Test
    void findByUuid_unknown() {
        when(userRepository.findByUuid("u")).thenReturn(Optional.empty());
        assertTrue(adapter.findByUuid("u").isEmpty());
    }

    @Test
    void findByUuid_returnsView() {
        UserEntity ue = new UserEntity();
        ue.setId(1L);
        ue.setUsername("alice");
        ue.setRole("PLAYER");
        ue.setState(2);
        // BaseAuthEntity setUuid is required for view; uuid not directly settable here
        // so we use reflection-friendly fields by calling the public setter chain.
        ue.setUuid("u");

        when(userRepository.findByUuid("u")).thenReturn(Optional.of(ue));
        Optional<UserAccessPort.UserView> v = adapter.findByUuid("u");
        assertTrue(v.isPresent());
        assertEquals(1L, v.get().id());
        assertEquals("u", v.get().uuid());
        assertEquals("alice", v.get().username());
        assertEquals("PLAYER", v.get().role());
        assertEquals(2, v.get().state());
        assertFalse(v.get().isBanned());
    }
}
