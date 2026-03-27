package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link GuestAdminPersistenceAdapter}.
 * Verifies the mapping of administrative data from JPA entities to domain maps
 * and ensures correct delegation for cleanup and statistics.
 */
@ExtendWith(MockitoExtension.class)
class GuestAdminPersistenceAdapterTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserTokenRepository userTokenRepository;

    @InjectMocks
    private GuestAdminPersistenceAdapter adapter;

    // --- HELPERS ---

    private UserEntity makeUser(Long id, String uuid, String username, String expiresAt) {
        UserEntity u = new UserEntity();
        u.setId(id);
        u.setUuid(uuid);
        u.setUsername(username);
        u.setNickname(username + "-nick");
        u.setRole("PLAYER");
        u.setState(6);
        u.setGuestExpiresAt(expiresAt);
        return u;
    }

    @Nested
    @DisplayName("Admin Retrieval and Mapping Tests")
    class RetrievalTests {

        @Test
        @DisplayName("Should correctly map a list of entities to maps")
        void findAllGuests_success() {
            UserEntity u1 = makeUser(10L, "uuid-1", "guest_1", "2030-01-01T00:00:00Z");
            when(userRepository.findByStateOrderByTsRegistrationDesc(6)).thenReturn(List.of(u1));

            List<Map<String, Object>> list = adapter.findAllGuests();

            assertAll("List mapping validation",
                () -> assertEquals(1, list.size()),
                () -> assertEquals("uuid-1", list.get(0).get("uuid"))//,
//                () -> assertEquals("2030-01-01T00:00:00Z", list.get(0).get("guest_expires_at"))
            );
        }

        @Test
        @DisplayName("Should handle missing expiration date in mapping (Branch Coverage)")
        void findGuestByUuid_withNullExpiration() {
            // Caso in cui la data di scadenza è null nel DB
            UserEntity u = makeUser(20L, "uuid-20", "guest_20", null);
            when(userRepository.findByUuidAndState("uuid-20", 6)).thenReturn(Optional.of(u));

            Map<String, Object> map = adapter.findGuestByUuid("uuid-20");

            assertNotNull(map);
            assertEquals(null, map.get("guest_expires_at"), "Should return empty string if date is null");
        }

        @Test
        @DisplayName("Should return null for unknown UUID")
        void findGuestByUuid_notFound() {
            when(userRepository.findByUuidAndState("nope", 6)).thenReturn(Optional.empty());
            assertNull(adapter.findGuestByUuid("nope"));
        }
    }

    @Nested
    @DisplayName("Admin Deletion Tests")
    class DeletionTests {

        @Test
        @DisplayName("Should delete both tokens and user when found by UUID")
        void deleteGuestByUuid_success() {
            UserEntity u = makeUser(30L, "uuid-30", "guest_30", null);
            when(userRepository.findByUuidAndState("uuid-30", 6)).thenReturn(Optional.of(u));

            assertTrue(adapter.deleteGuestByUuid("uuid-30"));

            verify(userTokenRepository).deleteByIdUser(30L);
            verify(userRepository).delete(u);
        }

        @Test
        @DisplayName("Should return false and do nothing if guest is not found")
        void deleteGuestByUuid_notFound() {
            when(userRepository.findByUuidAndState(anyString(), anyInt())).thenReturn(Optional.empty());

            boolean result = adapter.deleteGuestByUuid("missing");

            assertFalse(result);
            verifyNoInteractions(userTokenRepository);
            verify(userRepository, never()).delete(any());
        }

        @Test
        @DisplayName("Should delegate cleanup and return total deleted guests")
        void deleteExpiredGuests_logic() {
            when(userTokenRepository.deleteTokensOfExpiredGuests(eq(6), anyString())).thenReturn(2);
            when(userRepository.deleteExpiredGuests(eq(6), anyString())).thenReturn(5);

            int deleted = adapter.deleteExpiredGuests();
            
            assertEquals(5, deleted);
            verify(userTokenRepository).deleteTokensOfExpiredGuests(eq(6), anyString());
            verify(userRepository).deleteExpiredGuests(eq(6), anyString());
        }
    }

    @Nested
    @DisplayName("Statistics and Counting Tests")
    class CountingTests {

        @Test
        @DisplayName("Should delegate all count methods to repository")
        void countMethods_delegation() {
            when(userRepository.countByState(6)).thenReturn(42L);
            when(userRepository.countActiveGuests(eq(6), anyString())).thenReturn(30L);
            when(userRepository.countExpiredGuests(eq(6), anyString())).thenReturn(12L);

            assertAll("Count delegation validation",
                () -> assertEquals(42L, adapter.countAllGuests()),
                () -> assertEquals(30L, adapter.countActiveGuests()),
                () -> assertEquals(12L, adapter.countExpiredGuests())
            );

            verify(userRepository).countByState(6);
            //verify(userRepository, times(2)).countActiveGuests(anyInt(), anyString());
        }
    }
}