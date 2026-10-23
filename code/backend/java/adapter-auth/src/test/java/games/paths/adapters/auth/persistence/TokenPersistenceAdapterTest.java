package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.entity.UserEntity;
import games.paths.adapters.auth.entity.UserTokenEntity;
import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;
import games.paths.core.model.auth.RevokeReasons;
import games.paths.core.model.auth.StoredRefreshToken;
import games.paths.core.model.auth.UserStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TokenPersistenceAdapter}: v1.2.0 lookup by hash with the lazy rewrite of a
 * clear token, rotation, logout revoke, the session cap and the user lookups.
 */
@ExtendWith(MockitoExtension.class)
class TokenPersistenceAdapterTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserTokenRepository userTokenRepository;

    @InjectMocks
    private TokenPersistenceAdapter adapter;

    private static UserTokenEntity token(long id, boolean revoked, String rotated) {
        UserTokenEntity t = new UserTokenEntity();
        t.setId(id);
        t.setIdUser(3L);
        t.setRefreshToken("hash");
        t.setExpiresAt("2030-01-01T00:00:00Z");
        t.setRevoked(revoked);
        t.setTsRotated(rotated);
        return t;
    }

    @Test
    void findByHash() {
        when(userTokenRepository.findByRefreshToken("hash")).thenReturn(Optional.of(token(1L, true, "r")));
        StoredRefreshToken found = adapter.findRefreshToken("hash", "clear").orElseThrow();
        assertEquals(1L, found.id());
        assertEquals(3L, found.userId());
        assertTrue(found.revoked());
        assertEquals("r", found.tsRotated());
        verify(userTokenRepository, never()).findByRefreshToken("clear");
    }

    @Test
    void findNullHashIsEmpty() {
        assertTrue(adapter.findRefreshToken(null, "clear").isEmpty());
    }

    @Test
    void legacyClearValueIsRewrittenAsHash() {
        UserTokenEntity legacy = token(2L, false, null);
        legacy.setRefreshToken("clear");
        when(userTokenRepository.findByRefreshToken("hash")).thenReturn(Optional.empty());
        when(userTokenRepository.findByRefreshToken("clear")).thenReturn(Optional.of(legacy));
        assertTrue(adapter.findRefreshToken("hash", "clear").isPresent());
        assertEquals("hash", legacy.getRefreshToken());
        verify(userTokenRepository).save(legacy);
    }

    @Test
    void noLegacyValueNoFallback() {
        when(userTokenRepository.findByRefreshToken("hash")).thenReturn(Optional.empty());
        assertTrue(adapter.findRefreshToken("hash", null).isEmpty());
        verify(userTokenRepository, times(1)).findByRefreshToken(anyString());
    }

    @Test
    void markRotatedRevokesAndStamps() {
        UserTokenEntity t = token(1L, false, null);
        when(userTokenRepository.findById(1L)).thenReturn(Optional.of(t));
        adapter.markRotated(1L, "now");
        assertTrue(t.getRevoked());
        assertEquals("now", t.getTsRotated());
        assertEquals(RevokeReasons.ROTATED, t.getRevokedReason());
        when(userTokenRepository.findById(9L)).thenReturn(Optional.empty());
        adapter.markRotated(9L, "now");
        verify(userTokenRepository, times(1)).save(any());
    }

    @Test
    void revokeRefreshToken() {
        UserTokenEntity active = token(1L, false, null);
        when(userTokenRepository.findByRefreshToken("hash")).thenReturn(Optional.of(active));
        assertTrue(adapter.revokeRefreshToken("hash", null));
        assertEquals(RevokeReasons.LOGOUT, active.getRevokedReason());
        when(userTokenRepository.findByRefreshToken("hash")).thenReturn(Optional.of(token(1L, true, null)));
        assertFalse(adapter.revokeRefreshToken("hash", null));
        when(userTokenRepository.findByRefreshToken("hash")).thenReturn(Optional.empty());
        assertFalse(adapter.revokeRefreshToken("hash", null));
    }

    @Test
    void revokeAllAndCount() {
        when(userTokenRepository.revokeAllByUserId(eq(3L), anyString(), eq(RevokeReasons.LOGOUT_ALL))).thenReturn(2);
        assertEquals(2, adapter.revokeAllUserTokens(3L));
        when(userTokenRepository.revokeAllByUserId(eq(3L), anyString(), eq(RevokeReasons.ADMIN))).thenReturn(1);
        assertEquals(1, adapter.revokeAllUserTokens(3L, RevokeReasons.ADMIN));
        when(userTokenRepository.countActiveTokensByUserId(eq(3L), anyString())).thenReturn(4);
        assertEquals(4, adapter.countActiveTokensByUserId(3L));
    }

    @Test
    void storeRefreshTokenSavesTheHash() {
        ArgumentCaptor<UserTokenEntity> captor = ArgumentCaptor.forClass(UserTokenEntity.class);
        adapter.storeRefreshToken(5L, "hash", "2030-01-01T00:00:00Z");
        verify(userTokenRepository).save(captor.capture());
        assertEquals("hash", captor.getValue().getRefreshToken());
        assertEquals(5L, captor.getValue().getIdUser());
    }

    @Test
    void findUserIdByUuid() {
        UserEntity u = new UserEntity();
        u.setId(4L);
        when(userRepository.findByUuid("u")).thenReturn(Optional.of(u));
        when(userRepository.findByUuid("x")).thenReturn(Optional.empty());
        assertEquals(4L, adapter.findUserIdByUuid("u"));
        assertEquals(-1L, adapter.findUserIdByUuid("x"));
    }

    @Test
    void capRevokesTheOldest() {
        UserTokenEntity a = token(1L, false, null);
        UserTokenEntity b = token(2L, false, null);
        UserTokenEntity c = token(3L, false, null);
        when(userTokenRepository.findActiveTokensByUserIdOrderByTsInsertAsc(3L)).thenReturn(List.of(a, b, c));
        adapter.revokeOldestTokensIfLimitExceeded(3L, 2);
        assertTrue(a.getRevoked());
        assertEquals(RevokeReasons.LIMIT, a.getRevokedReason());
        assertNull(b.getRevokedReason());
        assertFalse(b.getRevoked());
        adapter.revokeOldestTokensIfLimitExceeded(3L, 5);
        verify(userTokenRepository, times(1)).save(any());
    }

    @Test
    void findUserByIdAndLastAccess() {
        UserEntity u = new UserEntity();
        u.setId(4L);
        u.setUuid("u");
        u.setUsername("name");
        u.setState(2);
        u.setRole("PLAYER");
        when(userRepository.findById(4L)).thenReturn(Optional.of(u));
        UserStatus status = adapter.findUserById(4L).orElseThrow();
        assertEquals("u", status.uuid());
        assertEquals(2, status.state());
        adapter.updateLastAccess(4L);
        assertNotNull(u.getTsLastAccess());
        verify(userRepository).save(u);
    }

    @Test
    void v170ReasonIsReadBack() {
        UserTokenEntity t = token(1L, true, null);
        t.setRevokedReason(RevokeReasons.LIMIT);
        when(userTokenRepository.findByRefreshToken("hash")).thenReturn(Optional.of(t));
        assertEquals(RevokeReasons.LIMIT, adapter.findRefreshToken("hash", null).orElseThrow().revokedReason());
    }

    @Test
    void v170RecentCountValidAfterAndPurge() {
        when(userTokenRepository.countActiveTokensIssuedAfter(eq(3L), anyString(), eq("bound"))).thenReturn(2);
        assertEquals(2, adapter.countActiveTokensIssuedAfter(3L, "bound"));
        adapter.setSessionsValidAfter(3L, "2026-10-22T10:00:00Z");
        verify(userRepository).updateSessionsValidAfter(3L, "2026-10-22T10:00:00Z");
        when(userTokenRepository.deleteShortLivedRevoked("before")).thenReturn(7);
        assertEquals(7, adapter.deleteShortLivedRevokedTokens("before"));
    }
}
