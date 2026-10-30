package games.paths.core.service.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.model.auth.StoredRefreshToken;
import games.paths.core.model.auth.TokenInfo;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.TokenPersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link SessionService}: v1.2.0 hashed refresh tokens, rotation of the used token only,
 * the grace window, SESSION_REVOKED, the user state check, logout, revoke-all and access validation.
 */
@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-19T10:00:00Z");
    private static final String TOKEN = "refresh-jwt";
    private static final String HASH = TokenHasher.sha256(TOKEN);
    private static final String UUID = "user-uuid";

    @Mock
    private JwtPort jwtPort;

    @Mock
    private TokenPersistencePort tokens;

    private SessionService service;

    @BeforeEach
    void setUp() {
        service = new SessionService(jwtPort, tokens, 5);
        service.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private void validRefreshJwt() {
        when(jwtPort.validateToken(TOKEN)).thenReturn(true);
        when(jwtPort.parseToken(TOKEN)).thenReturn(new HashMap<>(Map.of("type", "refresh", "sub", UUID)));
    }

    private static StoredRefreshToken stored(boolean revoked, String rotated) {
        return new StoredRefreshToken(10L, 1L, revoked, NOW.plusSeconds(3600).toString(), rotated);
    }

    private static UserStatus user(int state) {
        return new UserStatus(1L, UUID, "google_abc", "mario", "PLAYER", state, "en");
    }

    private void issuesTokens() {
        when(jwtPort.generateAccessToken(UUID, "google_abc", "PLAYER")).thenReturn("access-2");
        when(jwtPort.generateRefreshToken(UUID)).thenReturn("refresh-2");
        when(jwtPort.getRefreshTokenExpirationMs()).thenReturn(NOW.plusSeconds(7 * 86400).toEpochMilli());
        when(jwtPort.getAccessTokenExpirationMs()).thenReturn(NOW.plusSeconds(1800).toEpochMilli());
    }

    @Test
    @DisplayName("The two-argument constructor keeps the default cap")
    void defaultConstructor() {
        assertNotNull(new SessionService(jwtPort, tokens));
    }

    @Nested
    @DisplayName("refreshToken")
    class Refresh {

        @Test
        void nullBlankOrInvalidJwt() {
            assertNull(service.refreshToken(null));
            assertNull(service.refreshToken(" "));
            when(jwtPort.validateToken("bad")).thenReturn(false);
            assertNull(service.refreshToken("bad"));
        }

        @Test
        void claimsMissingOrNotRefresh() {
            when(jwtPort.validateToken(TOKEN)).thenReturn(true);
            when(jwtPort.parseToken(TOKEN)).thenReturn(null);
            assertNull(service.refreshToken(TOKEN));
            when(jwtPort.parseToken(TOKEN)).thenReturn(Map.of("type", "access"));
            assertNull(service.refreshToken(TOKEN));
        }

        @Test
        void unknownToken() {
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.empty());
            assertNull(service.refreshToken(TOKEN));
        }

        @Test
        void expiredOrUnreadableExpiry() {
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(
                    new StoredRefreshToken(10L, 1L, false, NOW.minusSeconds(1).toString(), null)));
            assertNull(service.refreshToken(TOKEN));
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(
                    new StoredRefreshToken(10L, 1L, false, "not-a-date", null)));
            assertNull(service.refreshToken(TOKEN));
        }

        @Test
        void rotatesOnlyTheUsedToken() {
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(stored(false, null)));
            when(tokens.findUserById(1L)).thenReturn(Optional.of(user(2)));
            issuesTokens();

            RefreshedSession session = service.refreshToken(TOKEN);

            assertEquals("access-2", session.getAccessToken());
            assertEquals("refresh-2", session.getRefreshToken());
            assertEquals("PLAYER", session.getRole());
            verify(tokens).markRotated(10L, NOW.toString());
            verify(tokens, never()).revokeAllUserTokens(anyLong());
            verify(tokens).storeRefreshToken(eq(1L), eq(TokenHasher.sha256("refresh-2")), anyString());
            verify(tokens).revokeOldestTokensIfLimitExceeded(1L, 5);
            verify(tokens).updateLastAccess(1L);
        }

        @Test
        void graceWindowAcceptsJustRotatedToken() {
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(
                    stored(true, NOW.minusSeconds(119).toString())));
            when(tokens.findUserById(1L)).thenReturn(Optional.of(user(2)));
            issuesTokens();

            assertNotNull(service.refreshToken(TOKEN));
            verify(tokens, never()).markRotated(anyLong(), anyString());
        }

        @Test
        void revokedAfterGraceIsSessionRevoked() {
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(
                    stored(true, NOW.minusSeconds(121).toString())));
            AuthException e = assertThrows(AuthException.class, () -> service.refreshToken(TOKEN));
            assertEquals(AuthException.Code.SESSION_REVOKED, e.getCode());
        }

        @Test
        void revokedByLogoutHasNoGrace() {
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(stored(true, null)));
            assertThrows(AuthException.class, () -> service.refreshToken(TOKEN));
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(stored(true, "garbage")));
            assertThrows(AuthException.class, () -> service.refreshToken(TOKEN));
        }

        @Test
        void missingUserOrOtherSubject() {
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(stored(false, null)));
            when(tokens.findUserById(1L)).thenReturn(Optional.empty());
            assertNull(service.refreshToken(TOKEN));
            when(tokens.findUserById(1L)).thenReturn(Optional.of(
                    new UserStatus(1L, "other", "u", "n", "PLAYER", 2, "en")));
            assertNull(service.refreshToken(TOKEN));
        }

        @Test
        void bannedAndDeletingUsersAreRefused() {
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(stored(false, null)));
            when(tokens.findUserById(1L)).thenReturn(Optional.of(user(4)));
            assertEquals(AuthException.Code.ACCOUNT_DISABLED,
                    assertThrows(AuthException.class, () -> service.refreshToken(TOKEN)).getCode());
            when(tokens.findUserById(1L)).thenReturn(Optional.of(user(7)));
            assertEquals(AuthException.Code.ACCOUNT_DELETION_IN_PROGRESS,
                    assertThrows(AuthException.class, () -> service.refreshToken(TOKEN)).getCode());
            verify(tokens, never()).markRotated(anyLong(), anyString());
        }

        @Test
        void theGuardAdmitsAndMayUnblockTheUser() {
            games.paths.core.port.auth.AccountGuardPort guard = mock(games.paths.core.port.auth.AccountGuardPort.class);
            service.setAccountGuard(guard);
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(stored(false, null)));
            when(tokens.findUserById(1L)).thenReturn(Optional.of(user(3)));
            when(guard.admit(user(3))).thenReturn(user(2));
            issuesTokens();
            assertEquals("access-2", service.refreshToken(TOKEN).getAccessToken());
            when(guard.admit(user(3))).thenThrow(new AuthException(AuthException.Code.ACCOUNT_DISABLED, "x", "2026-11-01T00:00:00Z"));
            assertEquals("2026-11-01T00:00:00Z",
                    assertThrows(AuthException.class, () -> service.refreshToken(TOKEN)).getSuspendedUntil());
        }

        @Test
        void noLegacyLookupAfterTheFallbackWindow() {
            service.setClock(Clock.fixed(TokenHasher.LEGACY_FALLBACK_UNTIL.plusSeconds(1), ZoneOffset.UTC));
            validRefreshJwt();
            when(tokens.findRefreshToken(HASH, null)).thenReturn(Optional.empty());
            assertNull(service.refreshToken(TOKEN));
            verify(tokens).findRefreshToken(HASH, null);
        }
    }

    @Nested
    @DisplayName("logout and revokeAllSessions")
    class Logout {

        @Test
        void logoutRevokesByHash() {
            assertFalse(service.logout(null));
            assertFalse(service.logout(""));
            when(tokens.revokeRefreshToken(HASH, TOKEN)).thenReturn(true);
            assertTrue(service.logout(TOKEN));
        }

        @Test
        void revokeAll() {
            assertFalse(service.revokeAllSessions(null));
            assertFalse(service.revokeAllSessions(" "));
            when(tokens.findUserIdByUuid("missing")).thenReturn(-1L);
            assertFalse(service.revokeAllSessions("missing"));
            when(tokens.findUserIdByUuid(UUID)).thenReturn(1L);
            assertTrue(service.revokeAllSessions(UUID));
            verify(tokens).revokeAllUserTokens(1L);
        }
    }

    @Nested
    @DisplayName("validateAccessToken")
    class Validate {

        @Test
        void invalidInputs() {
            assertNull(service.validateAccessToken(null));
            assertNull(service.validateAccessToken(" "));
            when(jwtPort.validateToken("t")).thenReturn(false);
            assertNull(service.validateAccessToken("t"));
        }

        @Test
        void claimsChecks() {
            when(jwtPort.validateToken("t")).thenReturn(true);
            when(jwtPort.parseToken("t")).thenReturn(null);
            assertNull(service.validateAccessToken("t"));
            when(jwtPort.parseToken("t")).thenReturn(Map.of("type", "refresh"));
            assertNull(service.validateAccessToken("t"));
            when(jwtPort.parseToken("t")).thenReturn(Map.of("type", "access"));
            assertNull(service.validateAccessToken("t"));
        }

        @Test
        void validToken() {
            when(jwtPort.validateToken("t")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>(Map.of("type", "access", "sub", UUID, "username", "u",
                    "role", "PLAYER", "jti", "j", "iat", 1L, "exp", 2L));
            when(jwtPort.parseToken("t")).thenReturn(claims);
            TokenInfo info = service.validateAccessToken("t");
            assertEquals(UUID, info.userUuid());
            assertEquals(1L, info.issuedAt());
            assertEquals(2L, info.expiresAt());
            claims.put("iat", "x");
            assertEquals(0L, service.validateAccessToken("t").issuedAt());
        }
    }
}
