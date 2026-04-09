package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.entity.UserTokenEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TokenPersistenceAdapter}.
 * Covers all branches of each method using Mockito mocks for JPA repositories.
 */
@ExtendWith(MockitoExtension.class)
class TokenPersistenceAdapterTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserTokenRepository userTokenRepository;

    @InjectMocks
    private TokenPersistenceAdapter adapter;

    // ==========================================================================
    // isRefreshTokenValid
    // ==========================================================================

    @Nested
    @DisplayName("isRefreshTokenValid Tests")
    class IsRefreshTokenValidTests {

        @Test
        @DisplayName("Should return false when token not found")
        void notFound() {
            when(userTokenRepository.findByRefreshTokenAndRevokedFalse("tok")).thenReturn(Optional.empty());
            assertFalse(adapter.isRefreshTokenValid("tok"));
        }

        @Test
        @DisplayName("Should return true when token found with null expiresAt (no expiry)")
        void nullExpiry() {
            UserTokenEntity entity = new UserTokenEntity();
            entity.setExpiresAt(null);
            when(userTokenRepository.findByRefreshTokenAndRevokedFalse("tok")).thenReturn(Optional.of(entity));
            assertTrue(adapter.isRefreshTokenValid("tok"));
        }

        @Test
        @DisplayName("Should return true when token is not yet expired")
        void notExpired() {
            UserTokenEntity entity = new UserTokenEntity();
            entity.setExpiresAt(Instant.now().plus(1, ChronoUnit.HOURS).toString());
            when(userTokenRepository.findByRefreshTokenAndRevokedFalse("tok")).thenReturn(Optional.of(entity));
            assertTrue(adapter.isRefreshTokenValid("tok"));
        }

        @Test
        @DisplayName("Should return false when token is expired")
        void expired() {
            UserTokenEntity entity = new UserTokenEntity();
            entity.setExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS).toString());
            when(userTokenRepository.findByRefreshTokenAndRevokedFalse("tok")).thenReturn(Optional.of(entity));
            assertFalse(adapter.isRefreshTokenValid("tok"));
        }

        @Test
        @DisplayName("Should return false when expiresAt is unparseable")
        void invalidExpiresAt() {
            UserTokenEntity entity = new UserTokenEntity();
            entity.setExpiresAt("not-a-date");
            when(userTokenRepository.findByRefreshTokenAndRevokedFalse("tok")).thenReturn(Optional.of(entity));
            assertFalse(adapter.isRefreshTokenValid("tok"));
        }
    }

    // ==========================================================================
    // findUserByRefreshToken
    // ==========================================================================

    @Nested
    @DisplayName("findUserByRefreshToken Tests")
    class FindUserByRefreshTokenTests {

        @Test
        @DisplayName("Should return null when token not found")
        void tokenNotFound() {
            when(userTokenRepository.findByRefreshTokenAndRevokedFalse("tok")).thenReturn(Optional.empty());
            assertNull(adapter.findUserByRefreshToken("tok"));
        }

        @Test
        @DisplayName("Should return null when user not found for token")
        void userNotFound() {
            UserTokenEntity tokenEntity = new UserTokenEntity();
            tokenEntity.setIdUser(99L);
            when(userTokenRepository.findByRefreshTokenAndRevokedFalse("tok")).thenReturn(Optional.of(tokenEntity));
            when(userRepository.findById(99L)).thenReturn(Optional.empty());
            assertNull(adapter.findUserByRefreshToken("tok"));
        }

        @Test
        @DisplayName("Should return user data when everything is found")
        void success() {
            UserTokenEntity tokenEntity = new UserTokenEntity();
            tokenEntity.setIdUser(10L);
            when(userTokenRepository.findByRefreshTokenAndRevokedFalse("tok")).thenReturn(Optional.of(tokenEntity));

            UserEntity user = new UserEntity();
            user.setId(10L);
            user.setUuid("u-10");
            user.setUsername("testuser");
            user.setRole("ADMIN");
            user.setState(1);
            when(userRepository.findById(10L)).thenReturn(Optional.of(user));

            Map<String, Object> result = adapter.findUserByRefreshToken("tok");
            assertNotNull(result);
            assertAll(
                () -> assertEquals(10L, result.get("id")),
                () -> assertEquals("u-10", result.get("uuid")),
                () -> assertEquals("testuser", result.get("username")),
                () -> assertEquals("ADMIN", result.get("role")),
                () -> assertEquals(1, result.get("state"))
            );
        }
    }

    // ==========================================================================
    // revokeRefreshToken
    // ==========================================================================

    @Nested
    @DisplayName("revokeRefreshToken Tests")
    class RevokeRefreshTokenTests {

        @Test
        @DisplayName("Should return false when token not found")
        void notFound() {
            when(userTokenRepository.findByRefreshToken("tok")).thenReturn(Optional.empty());
            assertFalse(adapter.revokeRefreshToken("tok"));
        }

        @Test
        @DisplayName("Should return false when token already revoked")
        void alreadyRevoked() {
            UserTokenEntity entity = new UserTokenEntity();
            entity.setRevoked(true);
            when(userTokenRepository.findByRefreshToken("tok")).thenReturn(Optional.of(entity));
            assertFalse(adapter.revokeRefreshToken("tok"));
        }

        @Test
        @DisplayName("Should revoke token and return true on success")
        void success() {
            UserTokenEntity entity = new UserTokenEntity();
            entity.setRevoked(false);
            when(userTokenRepository.findByRefreshToken("tok")).thenReturn(Optional.of(entity));

            assertTrue(adapter.revokeRefreshToken("tok"));

            assertTrue(entity.getRevoked());
            verify(userTokenRepository).save(entity);
        }
    }

    // ==========================================================================
    // revokeAllUserTokens
    // ==========================================================================

    @Test
    @DisplayName("revokeAllUserTokens should delegate to repository")
    void revokeAllUserTokens() {
        when(userTokenRepository.revokeAllByUserId(eq(10L), anyString())).thenReturn(3);
        int result = adapter.revokeAllUserTokens(10L);
        assertEquals(3, result);
    }

    // ==========================================================================
    // countActiveTokensByUserId
    // ==========================================================================

    @Test
    @DisplayName("countActiveTokensByUserId should delegate to repository")
    void countActiveTokensByUserId() {
        when(userTokenRepository.countActiveTokensByUserId(eq(10L), anyString())).thenReturn(2);
        assertEquals(2, adapter.countActiveTokensByUserId(10L));
    }

    // ==========================================================================
    // storeRefreshToken
    // ==========================================================================

    @Test
    @DisplayName("storeRefreshToken should create and save entity")
    void storeRefreshToken() {
        adapter.storeRefreshToken(42L, "new-tok", "2025-12-31T00:00:00Z");

        ArgumentCaptor<UserTokenEntity> captor = ArgumentCaptor.forClass(UserTokenEntity.class);
        verify(userTokenRepository).save(captor.capture());
        UserTokenEntity saved = captor.getValue();

        assertEquals(42L, saved.getIdUser());
        assertEquals("new-tok", saved.getRefreshToken());
        assertEquals("2025-12-31T00:00:00Z", saved.getExpiresAt());
    }

    // ==========================================================================
    // findUserIdByUuid
    // ==========================================================================

    @Nested
    @DisplayName("findUserIdByUuid Tests")
    class FindUserIdByUuidTests {

        @Test
        @DisplayName("Should return -1 when user not found")
        void notFound() {
            when(userRepository.findByUuid("unknown")).thenReturn(Optional.empty());
            assertEquals(-1L, adapter.findUserIdByUuid("unknown"));
        }

        @Test
        @DisplayName("Should return user id when found")
        void found() {
            UserEntity user = new UserEntity();
            user.setId(77L);
            when(userRepository.findByUuid("u-77")).thenReturn(Optional.of(user));
            assertEquals(77L, adapter.findUserIdByUuid("u-77"));
        }
    }

    // ==========================================================================
    // revokeOldestTokensIfLimitExceeded
    // ==========================================================================

    @Nested
    @DisplayName("revokeOldestTokensIfLimitExceeded Tests")
    class RevokeOldestTests {

        @Test
        @DisplayName("Should do nothing when within limit")
        void withinLimit() {
            UserTokenEntity t1 = new UserTokenEntity();
            when(userTokenRepository.findActiveTokensByUserIdOrderByTsInsertAsc(10L))
                    .thenReturn(List.of(t1));

            adapter.revokeOldestTokensIfLimitExceeded(10L, 5);
            verify(userTokenRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should revoke oldest tokens when limit exceeded")
        void exceedsLimit() {
            UserTokenEntity t1 = new UserTokenEntity();
            t1.setRevoked(false);
            UserTokenEntity t2 = new UserTokenEntity();
            t2.setRevoked(false);
            UserTokenEntity t3 = new UserTokenEntity();
            t3.setRevoked(false);

            when(userTokenRepository.findActiveTokensByUserIdOrderByTsInsertAsc(10L))
                    .thenReturn(List.of(t1, t2, t3));

            adapter.revokeOldestTokensIfLimitExceeded(10L, 2);

            // Should revoke the oldest one (t1) since 3 - 2 = 1 excess
            assertTrue(t1.getRevoked());
            verify(userTokenRepository).save(t1);
            verify(userTokenRepository, never()).save(t2);
            verify(userTokenRepository, never()).save(t3);
        }

        @Test
        @DisplayName("Should revoke multiple oldest tokens when excess is > 1")
        void multipleExcess() {
            UserTokenEntity t1 = new UserTokenEntity();
            t1.setRevoked(false);
            UserTokenEntity t2 = new UserTokenEntity();
            t2.setRevoked(false);
            UserTokenEntity t3 = new UserTokenEntity();
            t3.setRevoked(false);
            UserTokenEntity t4 = new UserTokenEntity();
            t4.setRevoked(false);

            when(userTokenRepository.findActiveTokensByUserIdOrderByTsInsertAsc(10L))
                    .thenReturn(List.of(t1, t2, t3, t4));

            adapter.revokeOldestTokensIfLimitExceeded(10L, 2);

            assertTrue(t1.getRevoked());
            assertTrue(t2.getRevoked());
            verify(userTokenRepository).save(t1);
            verify(userTokenRepository).save(t2);
            verify(userTokenRepository, never()).save(t3);
            verify(userTokenRepository, never()).save(t4);
        }

        @Test
        @DisplayName("Should handle empty list (no active tokens)")
        void emptyList() {
            when(userTokenRepository.findActiveTokensByUserIdOrderByTsInsertAsc(10L))
                    .thenReturn(List.of());

            adapter.revokeOldestTokensIfLimitExceeded(10L, 5);
            verify(userTokenRepository, never()).save(any());
        }
    }
}
