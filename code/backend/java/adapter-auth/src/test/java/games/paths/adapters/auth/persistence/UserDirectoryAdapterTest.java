package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.core.model.auth.AdminUserView;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** UserDirectoryAdapter (v0.41.6): id, uuid, email and username lookups mapped to AdminUserView. */
class UserDirectoryAdapterTest {

    private UserRepository repo;
    private UserDirectoryAdapter adapter;

    @BeforeEach
    void setUp() {
        repo = mock(UserRepository.class);
        adapter = new UserDirectoryAdapter(repo);
    }

    private static UserEntity user(long id, String username) {
        UserEntity u = new UserEntity();
        u.setId(id);
        u.setUuid("uuid-" + id);
        u.setUsername(username);
        u.setNickname("Nick " + id);
        u.setEmailAddress(username + "@test.local");
        u.setRole("PLAYER");
        u.setState(6);
        u.setGuestExpiresAt("2030-01-01T00:00:00Z");
        u.setTsLastAccess("2026-02-01T00:00:00Z");
        return u;
    }

    @Test
    void findById_mapsEveryField() {
        when(repo.findById(1L)).thenReturn(Optional.of(user(1, "alice")));
        AdminUserView v = adapter.findById(1L).orElseThrow();
        assertEquals(new AdminUserView(1L, "uuid-1", "alice", "Nick 1", "alice@test.local", "PLAYER", 6,
                "2030-01-01T00:00:00Z", null, "2026-02-01T00:00:00Z", 0), v);
    }

    @Test
    void findByUuid_blankAndHit() {
        assertTrue(adapter.findByUuid(null).isEmpty());
        assertTrue(adapter.findByUuid(" ").isEmpty());
        when(repo.findByUuid("uuid-2")).thenReturn(Optional.of(user(2, "bob")));
        assertEquals("bob", adapter.findByUuid("uuid-2").orElseThrow().username());
    }

    @Test
    void findByEmail_trimmedListOrEmpty() {
        assertTrue(adapter.findByEmail(null).isEmpty());
        assertTrue(adapter.findByEmail("").isEmpty());
        when(repo.findByEmailIgnoreCase("A@x.it")).thenReturn(List.of(user(1, "a"), user(2, "b")));
        assertEquals(2, adapter.findByEmail(" A@x.it ").size());
    }

    @Test
    void findByUsername_trimmedListOrEmpty() {
        assertTrue(adapter.findByUsername(null).isEmpty());
        assertTrue(adapter.findByUsername("  ").isEmpty());
        when(repo.findByUsernameOrderByIdAsc("carl")).thenReturn(List.of(user(3, "carl")));
        assertEquals("uuid-3", adapter.findByUsername("carl ").get(0).uuid());
        verify(repo).findByUsernameOrderByIdAsc("carl");
    }
}
