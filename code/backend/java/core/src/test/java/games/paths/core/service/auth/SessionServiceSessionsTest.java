package games.paths.core.service.auth;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.model.auth.RevokeReasons;
import games.paths.core.model.auth.StoredRefreshToken;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.SessionPort;
import games.paths.core.port.auth.TokenPersistencePort;
import games.paths.core.port.auth.UserStatePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * v1.7.0 step 12 of {@link SessionService}: cap of 12 with SESSION_LIMIT, 2-minute grace, reuse detection,
 * guest refresh capped at 180 days, 250-day expiry kept as issued, activeSessions, purge, sessions_valid_after.
 */
@ExtendWith(MockitoExtension.class)
class SessionServiceSessionsTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00.700Z");
    private static final String TOKEN = "refresh-jwt";
    private static final String HASH = TokenHasher.sha256(TOKEN);
    private static final String UUID = "user-uuid";

    @Mock
    private JwtPort jwtPort;
    @Mock
    private TokenPersistencePort tokens;
    @Mock
    private UserStatePort userState;

    private SessionService service;

    @BeforeEach
    void setUp() {
        service = new SessionService(jwtPort, tokens);
        service.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
        service.setUserState(userState);
    }

    private void validRefreshJwt() {
        when(jwtPort.validateToken(TOKEN)).thenReturn(true);
        when(jwtPort.parseToken(TOKEN)).thenReturn(new HashMap<>(Map.of("type", "refresh", "sub", UUID)));
    }

    private static StoredRefreshToken revoked(String reason, String rotated) {
        return new StoredRefreshToken(10L, 1L, true, NOW.plus(5, ChronoUnit.DAYS).toString(), rotated, reason);
    }

    private static UserStatus user(int state) {
        return new UserStatus(1L, UUID, "u", "n", "PLAYER", state, "en");
    }

    private void issuesTokens(long jwtExpiresMs) {
        when(jwtPort.generateAccessToken(eq(UUID), anyString(), eq("PLAYER"))).thenReturn("access-2");
        when(jwtPort.generateRefreshToken(UUID)).thenReturn("refresh-2");
        when(jwtPort.getRefreshTokenExpirationMs()).thenReturn(jwtExpiresMs);
        when(jwtPort.getAccessTokenExpirationMs()).thenReturn(NOW.plusSeconds(1800).toEpochMilli());
    }

    @Test
    void defaultsAreTwelveSessionsAndTwoMinutes() {
        assertEquals(12, SessionService.DEFAULT_MAX_TOKENS_PER_USER);
        assertEquals(120, SessionService.GRACE_SECONDS);
    }

    @Test
    void theCapOfTwelveIsEnforcedAtRefresh() {
        validRefreshJwt();
        when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(
                new StoredRefreshToken(10L, 1L, false, NOW.plus(5, ChronoUnit.DAYS).toString(), null)));
        when(tokens.findUserById(1L)).thenReturn(Optional.of(user(2)));
        issuesTokens(NOW.plus(250, ChronoUnit.DAYS).toEpochMilli());
        RefreshedSession s = service.refreshToken(TOKEN);
        assertEquals(NOW.plus(250, ChronoUnit.DAYS).toEpochMilli(), s.getRefreshTokenExpiresAt());
        verify(tokens).revokeOldestTokensIfLimitExceeded(1L, 12);
        verify(tokens).storeRefreshToken(1L, TokenHasher.sha256("refresh-2"),
                NOW.plus(250, ChronoUnit.DAYS).toString());
    }

    @Test
    void aTokenRevokedByTheCapAnswersSessionLimit() {
        validRefreshJwt();
        when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(revoked(RevokeReasons.LIMIT, null)));
        AuthException e = assertThrows(AuthException.class, () -> service.refreshToken(TOKEN));
        assertEquals(AuthException.Code.SESSION_LIMIT, e.getCode());
        assertEquals(401, e.getCode().httpStatus());
        verify(tokens, never()).revokeAllUserTokens(anyLong());
    }

    @Test
    void otherReasonsAnswerSessionRevokedWithoutCuttingTheOthers() {
        validRefreshJwt();
        for (String reason : new String[] {RevokeReasons.LOGOUT, RevokeReasons.LOGOUT_ALL, RevokeReasons.ADMIN, null}) {
            when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(revoked(reason, null)));
            assertEquals(AuthException.Code.SESSION_REVOKED,
                    assertThrows(AuthException.class, () -> service.refreshToken(TOKEN)).getCode());
        }
        verify(tokens, never()).revokeAllUserTokens(anyLong());
        verify(tokens, never()).setSessionsValidAfter(anyLong(), anyString());
    }

    @Test
    void aRotatedTokenReusedAfterTheGraceRevokesEverySession() {
        validRefreshJwt();
        when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(
                revoked(RevokeReasons.ROTATED, NOW.minusSeconds(121).toString())));
        when(tokens.findUserById(1L)).thenReturn(Optional.of(user(2)));
        assertEquals(AuthException.Code.SESSION_REVOKED,
                assertThrows(AuthException.class, () -> service.refreshToken(TOKEN)).getCode());
        verify(tokens).revokeAllUserTokens(1L);
        verify(tokens).setSessionsValidAfter(1L, "2026-10-22T10:00:00Z");
        verify(userState).evict(UUID);
    }

    @Test
    void aRotatedTokenAtTheEdgeOfTheGraceIsStillAccepted() {
        validRefreshJwt();
        when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(
                revoked(RevokeReasons.ROTATED, NOW.minusSeconds(120).toString())));
        when(tokens.findUserById(1L)).thenReturn(Optional.of(user(2)));
        issuesTokens(NOW.plus(250, ChronoUnit.DAYS).toEpochMilli());
        assertNotNull(service.refreshToken(TOKEN));
        verify(tokens, never()).revokeAllUserTokens(anyLong());
        verify(tokens, never()).markRotated(anyLong(), anyString());
    }

    @Test
    void reuseOfAnUnknownUserStillAnswersSessionRevoked() {
        validRefreshJwt();
        when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(
                revoked(RevokeReasons.ROTATED, NOW.minusSeconds(600).toString())));
        when(tokens.findUserById(1L)).thenReturn(Optional.empty());
        assertThrows(AuthException.class, () -> service.refreshToken(TOKEN));
        verify(tokens, never()).revokeAllUserTokens(anyLong());
    }

    @Test
    void aGuestRefreshIsCappedAt180Days() {
        validRefreshJwt();
        when(tokens.findRefreshToken(HASH, TOKEN)).thenReturn(Optional.of(
                new StoredRefreshToken(10L, 1L, false, NOW.plus(5, ChronoUnit.DAYS).toString(), null)));
        when(tokens.findUserById(1L)).thenReturn(Optional.of(user(6)));
        issuesTokens(NOW.plus(250, ChronoUnit.DAYS).toEpochMilli());
        RefreshedSession s = service.refreshToken(TOKEN);
        assertEquals(NOW.plus(180, ChronoUnit.DAYS).toEpochMilli(), s.getRefreshTokenExpiresAt());
        verify(tokens).storeRefreshToken(1L, TokenHasher.sha256("refresh-2"),
                NOW.plus(180, ChronoUnit.DAYS).toString());
    }

    @Test
    void refreshExpiryHelper() {
        long longer = NOW.plus(250, ChronoUnit.DAYS).toEpochMilli();
        long shorter = NOW.plus(7, ChronoUnit.DAYS).toEpochMilli();
        assertEquals(longer, SessionService.refreshExpiry(longer, false, NOW));
        assertEquals(NOW.plus(180, ChronoUnit.DAYS).toEpochMilli(), SessionService.refreshExpiry(longer, true, NOW));
        assertEquals(shorter, SessionService.refreshExpiry(shorter, true, NOW));
    }

    @Test
    void logoutAllRevokesSetsValidAfterAndEvicts() {
        when(tokens.findUserIdByUuid(UUID)).thenReturn(1L);
        when(tokens.findUserById(1L)).thenReturn(Optional.of(user(2)));
        assertTrue(service.revokeAllSessions(UUID));
        verify(tokens).revokeAllUserTokens(1L);
        verify(tokens).setSessionsValidAfter(1L, "2026-10-22T10:00:00Z");
        verify(userState).evict(UUID);
    }

    @Test
    void logoutAllWithoutUserStateStillSetsValidAfter() {
        SessionService plain = new SessionService(jwtPort, tokens, 12);
        plain.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
        when(tokens.findUserIdByUuid(UUID)).thenReturn(1L);
        when(tokens.findUserById(1L)).thenReturn(Optional.of(user(2)));
        assertTrue(plain.revokeAllSessions(UUID));
        verify(tokens).setSessionsValidAfter(1L, "2026-10-22T10:00:00Z");
        verifyNoInteractions(userState);
    }

    @Test
    void activeSessionsCountsTheLast30Days() {
        assertEquals(0, service.activeSessions(null));
        assertEquals(0, service.activeSessions(" "));
        when(tokens.findUserIdByUuid("missing")).thenReturn(-1L);
        assertEquals(0, service.activeSessions("missing"));
        when(tokens.findUserIdByUuid(UUID)).thenReturn(1L);
        when(tokens.countActiveTokensIssuedAfter(1L, NOW.minus(30, ChronoUnit.DAYS).toString())).thenReturn(3);
        assertEquals(3, service.activeSessions(UUID));
    }

    @Test
    void purgeRemovesRowsOlderThanSevenDays() {
        when(tokens.deleteShortLivedRevokedTokens(NOW.minus(7, ChronoUnit.DAYS).toString())).thenReturn(4);
        assertEquals(4, service.purgeRevokedTokens());
    }

    @Test
    void validAfterIsTruncatedToTheSecond() {
        assertEquals("2026-10-22T10:00:00Z", SessionService.validAfter(NOW));
    }

    @Test
    void portDefaultsAnswerZero() {
        SessionPort port = new SessionPort() {
            public RefreshedSession refreshToken(String refreshToken) { return null; }
            public boolean logout(String refreshToken) { return false; }
            public boolean revokeAllSessions(String userUuid) { return false; }
            public games.paths.core.model.auth.TokenInfo validateAccessToken(String accessToken) { return null; }
        };
        assertEquals(0, port.activeSessions(UUID));
        assertEquals(0, port.purgeRevokedTokens());
    }

    @Test
    void userStatusAcceptsTokensFromTheBoundarySecond() {
        long bound = Instant.parse("2026-10-22T10:00:00Z").getEpochSecond();
        UserStatus u = new UserStatus(1L, UUID, "u", "n", "PLAYER", 2, "en", bound);
        assertFalse(u.acceptsTokenIssuedAt(bound - 1));
        assertTrue(u.acceptsTokenIssuedAt(bound));
        assertTrue(u.acceptsTokenIssuedAt(bound + 1));
        assertTrue(user(2).acceptsTokenIssuedAt(0));
        assertEquals(0L, user(2).sessionsValidAfter());
    }

    @Test
    void storedTokenKeepsItsReason() {
        assertNull(new StoredRefreshToken(1L, 2L, false, "e", null).revokedReason());
        assertEquals(RevokeReasons.LIMIT, revoked(RevokeReasons.LIMIT, null).revokedReason());
    }
}
