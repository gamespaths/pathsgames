package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.entity.UserTokenEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link GuestPersistenceAdapter}.
 * Verifies mapping between domain data and JPA entities, and repository interaction.
 */
@ExtendWith(MockitoExtension.class)
class GuestPersistenceAdapterTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserTokenRepository userTokenRepository;

    @InjectMocks
    private GuestPersistenceAdapter adapter;


    @Nested
    @DisplayName("Guest Creation and Updates")
    class CreationTests {

        @Test
        @DisplayName("Should correctly map all fields to UserEntity and return saved ID")
        void createGuestUser_success() {
            // Arrange
            UserEntity saved = new UserEntity();
            saved.setId(100L);
            ArgumentCaptor<UserEntity> captor = ArgumentCaptor.forClass(UserEntity.class);
            when(userRepository.save(any(UserEntity.class))).thenReturn(saved);

            // Act
            long id = adapter.createGuestUser("uuid-x", "user-x", "cookie-x", "2030-01-01T00:00:00Z");

            // Assert
            assertEquals(100L, id);
            verify(userRepository).save(captor.capture());
            UserEntity captured = captor.getValue();
            
            assertAll("Entity mapping validation",
                () -> assertEquals("uuid-x", captured.getUuid()),
                () -> assertEquals("user-x", captured.getUsername()),
                () -> assertEquals("PLAYER", captured.getRole()),
                () -> assertEquals(6, captured.getState()),
                () -> assertEquals("cookie-x", captured.getGuestCookieToken())
            );
        }

        @Test
        @DisplayName("Should update last access timestamp if user is found")
        void updateLastAccess_found() {
            UserEntity user = new UserEntity();
            user.setId(11L);
            when(userRepository.findById(11L)).thenReturn(Optional.of(user));

            adapter.updateLastAccess(11L);

            verify(userRepository).save(user);
            assertNotNull(user.getTsLastAccess(), "Timestamp should be populated");
        }

        @Test
        @DisplayName("Should do nothing if user is not found for last access update")
        void updateLastAccess_notFound() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());
            
            adapter.updateLastAccess(99L);
            
            verify(userRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Guest Retrieval Tests")
    class RetrievalTests {

        @Test
        @DisplayName("Should return a populated map when guest is found by cookie")
        void findGuestByCookieToken_found() {
            UserEntity user = new UserEntity();
            user.setId(7L);
            user.setUuid("u-7");
            user.setUsername("guest7");
            user.setGuestExpiresAt("2030-01-01T00:00:00Z");

            when(userRepository.findByGuestCookieTokenAndState("token", 6)).thenReturn(Optional.of(user));

            Map<String, Object> res = adapter.findGuestByCookieToken("token");

            assertNotNull(res);
            assertEquals(7L, ((Number) res.get("id")).longValue());
            assertEquals("u-7", res.get("uuid"));
            assertEquals("2030-01-01T00:00:00Z", res.get("guest_expires_at"));
        }

        @Test
        @DisplayName("Should return empty string for guest_expires_at if null in database (Sonar coverage)")
        void findGuestByCookieToken_nullExpiration() {
            UserEntity user = new UserEntity();
            user.setId(8L);
            user.setUuid("1");
            user.setUsername("username");
            user.setGuestExpiresAt(null);

            when(userRepository.findByGuestCookieTokenAndState("token-null", 6)).thenReturn(Optional.of(user));

            Map<String, Object> res = adapter.findGuestByCookieToken("token-null");

            assertEquals("", res.get("guest_expires_at"), "Branch coverage for null expiration");
        }

        @Test
        @DisplayName("Should return null when cookie token does not exist")
        void findGuestByCookieToken_notFound() {
            when(userRepository.findByGuestCookieTokenAndState("unknown", 6)).thenReturn(Optional.empty());
            assertNull(adapter.findGuestByCookieToken("unknown"));
        }
    }


    @Nested
    @DisplayName("Token Management and Cleanup")
    class TokenAndCleanupTests {

        @Test
        @DisplayName("Should correctly map and save refresh token entity")
        void storeRefreshToken_success() {
            ArgumentCaptor<UserTokenEntity> captor = ArgumentCaptor.forClass(UserTokenEntity.class);

            adapter.storeRefreshToken(5L, "rt-abc", "2030-01-01T00:00:00Z");

            verify(userTokenRepository).save(captor.capture());
            UserTokenEntity t = captor.getValue();
            assertAll("Token entity validation",
                () -> assertEquals(5L, t.getIdUser()),
                () -> assertEquals("rt-abc", t.getRefreshToken()),
                () -> assertEquals("2030-01-01T00:00:00Z", t.getExpiresAt())
            );
        }

        @Test
        @DisplayName("Should delegate cleanup to repositories and return deleted user count")
        void deleteExpiredGuests_logic() {
            when(userTokenRepository.deleteTokensOfExpiredGuests(anyInt(), anyString())).thenReturn(5);
            when(userRepository.deleteExpiredGuests(anyInt(), anyString())).thenReturn(3);

            int deleted = adapter.deleteExpiredGuests();

            assertEquals(3, deleted);
            verify(userTokenRepository).deleteTokensOfExpiredGuests(eq(6), anyString());
            verify(userRepository).deleteExpiredGuests(eq(6), anyString());
        }
    }
}