package games.paths.core.service.auth;

import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.model.auth.TokenInfo;
import games.paths.core.port.auth.JwtPort;
import games.paths.core.port.auth.TokenPersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link SessionService}.
 * Covers all branches: refreshToken, logout, revokeAllSessions, validateAccessToken.
 */
@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    @Mock
    private JwtPort jwtPort;

    @Mock
    private TokenPersistencePort tokenPersistencePort;

    private SessionService sessionService;

    @BeforeEach
    void setUp() {
        sessionService = new SessionService(jwtPort, tokenPersistencePort, 5);
    }

    // === Constructor tests ===

    @Test
    @DisplayName("Should use default maxTokensPerUser via 2-arg constructor")
    void constructor_defaultMaxTokens() {
        SessionService svc = new SessionService(jwtPort, tokenPersistencePort);
        // Should not throw, uses default MAX_TOKENS_PER_USER = 5
        assertNotNull(svc);
    }

    // ==========================================================================
    // refreshToken
    // ==========================================================================

    @Nested
    @DisplayName("refreshToken Tests")
    class RefreshTokenTests {

        @Test
        @DisplayName("Should return null when refreshToken is null")
        void refreshToken_null() {
            assertNull(sessionService.refreshToken(null));
        }

        @Test
        @DisplayName("Should return null when refreshToken is blank")
        void refreshToken_blank() {
            assertNull(sessionService.refreshToken("  "));
        }

        @Test
        @DisplayName("Should return null when JWT validation fails")
        void refreshToken_invalidJwt() {
            when(jwtPort.validateToken("bad-token")).thenReturn(false);
            assertNull(sessionService.refreshToken("bad-token"));
        }

        @Test
        @DisplayName("Should return null when parseToken returns null")
        void refreshToken_parseReturnsNull() {
            when(jwtPort.validateToken("valid")).thenReturn(true);
            when(jwtPort.parseToken("valid")).thenReturn(null);
            assertNull(sessionService.refreshToken("valid"));
        }

        @Test
        @DisplayName("Should return null when token type is not 'refresh'")
        void refreshToken_notRefreshType() {
            when(jwtPort.validateToken("access-tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "access");
            when(jwtPort.parseToken("access-tok")).thenReturn(claims);
            assertNull(sessionService.refreshToken("access-tok"));
        }

        @Test
        @DisplayName("Should return null when token type is null")
        void refreshToken_nullType() {
            when(jwtPort.validateToken("no-type")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", null);
            when(jwtPort.parseToken("no-type")).thenReturn(claims);
            assertNull(sessionService.refreshToken("no-type"));
        }

        @Test
        @DisplayName("Should return null when refresh token is revoked in DB")
        void refreshToken_revokedInDb() {
            when(jwtPort.validateToken("revoked-tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "refresh");
            when(jwtPort.parseToken("revoked-tok")).thenReturn(claims);
            when(tokenPersistencePort.isRefreshTokenValid("revoked-tok")).thenReturn(false);
            assertNull(sessionService.refreshToken("revoked-tok"));
        }

        @Test
        @DisplayName("Should return null when userData is null")
        void refreshToken_userDataNull() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "refresh");
            when(jwtPort.parseToken("tok")).thenReturn(claims);
            when(tokenPersistencePort.isRefreshTokenValid("tok")).thenReturn(true);
            when(tokenPersistencePort.findUserByRefreshToken("tok")).thenReturn(null);
            assertNull(sessionService.refreshToken("tok"));
        }

        @Test
        @DisplayName("Should return null when userData is missing required uuid")
        void refreshToken_missingUuid() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "refresh");
            when(jwtPort.parseToken("tok")).thenReturn(claims);
            when(tokenPersistencePort.isRefreshTokenValid("tok")).thenReturn(true);

            Map<String, Object> userData = new HashMap<>();
            userData.put("uuid", null);
            userData.put("username", "guest_1");
            userData.put("id", 42L);
            when(tokenPersistencePort.findUserByRefreshToken("tok")).thenReturn(userData);

            assertNull(sessionService.refreshToken("tok"));
        }

        @Test
        @DisplayName("Should return null when userData is missing username")
        void refreshToken_missingUsername() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "refresh");
            when(jwtPort.parseToken("tok")).thenReturn(claims);
            when(tokenPersistencePort.isRefreshTokenValid("tok")).thenReturn(true);

            Map<String, Object> userData = new HashMap<>();
            userData.put("uuid", "u-1");
            userData.put("username", null);
            userData.put("id", 42L);
            when(tokenPersistencePort.findUserByRefreshToken("tok")).thenReturn(userData);

            assertNull(sessionService.refreshToken("tok"));
        }

        @Test
        @DisplayName("Should return null when userData is missing id")
        void refreshToken_missingId() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "refresh");
            when(jwtPort.parseToken("tok")).thenReturn(claims);
            when(tokenPersistencePort.isRefreshTokenValid("tok")).thenReturn(true);

            Map<String, Object> userData = new HashMap<>();
            userData.put("uuid", "u-1");
            userData.put("username", "guest_1");
            // no id
            when(tokenPersistencePort.findUserByRefreshToken("tok")).thenReturn(userData);

            assertNull(sessionService.refreshToken("tok"));
        }

        @Test
        @DisplayName("Should successfully refresh token with non-null role")
        void refreshToken_successWithRole() {
            String oldRefresh = "valid-refresh";
            when(jwtPort.validateToken(oldRefresh)).thenReturn(true);

            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "refresh");
            when(jwtPort.parseToken(oldRefresh)).thenReturn(claims);
            when(tokenPersistencePort.isRefreshTokenValid(oldRefresh)).thenReturn(true);

            Map<String, Object> userData = new HashMap<>();
            userData.put("uuid", "u-42");
            userData.put("username", "testuser");
            userData.put("role", "ADMIN");
            userData.put("id", 100L);
            when(tokenPersistencePort.findUserByRefreshToken(oldRefresh)).thenReturn(userData);

            when(jwtPort.generateAccessToken("u-42", "testuser", "ADMIN")).thenReturn("new-access");
            when(jwtPort.generateRefreshToken("u-42")).thenReturn("new-refresh");
            when(jwtPort.getRefreshTokenExpirationMs()).thenReturn(999999L);
            when(jwtPort.getAccessTokenExpirationMs()).thenReturn(500000L);

            RefreshedSession session = sessionService.refreshToken(oldRefresh);

            assertNotNull(session);
            assertAll(
                () -> assertEquals("u-42", session.getUserUuid()),
                () -> assertEquals("testuser", session.getUsername()),
                () -> assertEquals("ADMIN", session.getRole()),
                () -> assertEquals("new-access", session.getAccessToken()),
                () -> assertEquals("new-refresh", session.getRefreshToken()),
                () -> assertEquals(500000L, session.getAccessTokenExpiresAt()),
                () -> assertEquals(999999L, session.getRefreshTokenExpiresAt())
            );

            verify(tokenPersistencePort).revokeAllUserTokens(100L);
            verify(tokenPersistencePort).storeRefreshToken(eq(100L), eq("new-refresh"), anyString());
        }

        @Test
        @DisplayName("Should default role to PLAYER when role is null")
        void refreshToken_nullRoleDefaultsToPlayer() {
            String oldRefresh = "refresh-null-role";
            when(jwtPort.validateToken(oldRefresh)).thenReturn(true);

            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "refresh");
            when(jwtPort.parseToken(oldRefresh)).thenReturn(claims);
            when(tokenPersistencePort.isRefreshTokenValid(oldRefresh)).thenReturn(true);

            Map<String, Object> userData = new HashMap<>();
            userData.put("uuid", "u-1");
            userData.put("username", "guest_u1");
            userData.put("role", null); // null role
            userData.put("id", 50L);
            when(tokenPersistencePort.findUserByRefreshToken(oldRefresh)).thenReturn(userData);

            when(jwtPort.generateAccessToken("u-1", "guest_u1", "PLAYER")).thenReturn("acc");
            when(jwtPort.generateRefreshToken("u-1")).thenReturn("ref");
            when(jwtPort.getRefreshTokenExpirationMs()).thenReturn(1000L);
            when(jwtPort.getAccessTokenExpirationMs()).thenReturn(500L);

            RefreshedSession session = sessionService.refreshToken(oldRefresh);

            assertNotNull(session);
            assertEquals("PLAYER", session.getRole());
            verify(jwtPort).generateAccessToken("u-1", "guest_u1", "PLAYER");
        }
    }

    // ==========================================================================
    // logout
    // ==========================================================================

    @Nested
    @DisplayName("logout Tests")
    class LogoutTests {

        @Test
        @DisplayName("Should return false when refreshToken is null")
        void logout_null() {
            assertFalse(sessionService.logout(null));
        }

        @Test
        @DisplayName("Should return false when refreshToken is blank")
        void logout_blank() {
            assertFalse(sessionService.logout("  "));
        }

        @Test
        @DisplayName("Should delegate to persistence and return true on success")
        void logout_success() {
            when(tokenPersistencePort.revokeRefreshToken("tok-1")).thenReturn(true);
            assertTrue(sessionService.logout("tok-1"));
            verify(tokenPersistencePort).revokeRefreshToken("tok-1");
        }

        @Test
        @DisplayName("Should return false when persistence reports failure")
        void logout_notFound() {
            when(tokenPersistencePort.revokeRefreshToken("unknown")).thenReturn(false);
            assertFalse(sessionService.logout("unknown"));
        }
    }

    // ==========================================================================
    // revokeAllSessions
    // ==========================================================================

    @Nested
    @DisplayName("revokeAllSessions Tests")
    class RevokeAllSessionsTests {

        @Test
        @DisplayName("Should return false when userUuid is null")
        void revokeAll_null() {
            assertFalse(sessionService.revokeAllSessions(null));
        }

        @Test
        @DisplayName("Should return false when userUuid is blank")
        void revokeAll_blank() {
            assertFalse(sessionService.revokeAllSessions("   "));
        }

        @Test
        @DisplayName("Should return false when user is not found (userId < 0)")
        void revokeAll_userNotFound() {
            when(tokenPersistencePort.findUserIdByUuid("unknown-uuid")).thenReturn(-1L);
            assertFalse(sessionService.revokeAllSessions("unknown-uuid"));
        }

        @Test
        @DisplayName("Should revoke all tokens and return true on success")
        void revokeAll_success() {
            when(tokenPersistencePort.findUserIdByUuid("u-1")).thenReturn(10L);
            when(tokenPersistencePort.revokeAllUserTokens(10L)).thenReturn(3);

            assertTrue(sessionService.revokeAllSessions("u-1"));
            verify(tokenPersistencePort).revokeAllUserTokens(10L);
        }
    }

    // ==========================================================================
    // validateAccessToken
    // ==========================================================================

    @Nested
    @DisplayName("validateAccessToken Tests")
    class ValidateAccessTokenTests {

        @Test
        @DisplayName("Should return null when accessToken is null")
        void validate_null() {
            assertNull(sessionService.validateAccessToken(null));
        }

        @Test
        @DisplayName("Should return null when accessToken is blank")
        void validate_blank() {
            assertNull(sessionService.validateAccessToken("  "));
        }

        @Test
        @DisplayName("Should return null when JWT validation fails")
        void validate_invalidJwt() {
            when(jwtPort.validateToken("bad")).thenReturn(false);
            assertNull(sessionService.validateAccessToken("bad"));
        }

        @Test
        @DisplayName("Should return null when parseToken returns null")
        void validate_parseNull() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            when(jwtPort.parseToken("tok")).thenReturn(null);
            assertNull(sessionService.validateAccessToken("tok"));
        }

        @Test
        @DisplayName("Should return null when token type is not 'access'")
        void validate_notAccessType() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "refresh");
            when(jwtPort.parseToken("tok")).thenReturn(claims);
            assertNull(sessionService.validateAccessToken("tok"));
        }

        @Test
        @DisplayName("Should return null when type is null")
        void validate_nullType() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", null);
            when(jwtPort.parseToken("tok")).thenReturn(claims);
            assertNull(sessionService.validateAccessToken("tok"));
        }

        @Test
        @DisplayName("Should return null when subject (userUuid) is null")
        void validate_nullSubject() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "access");
            claims.put("sub", null);
            when(jwtPort.parseToken("tok")).thenReturn(claims);
            assertNull(sessionService.validateAccessToken("tok"));
        }

        @Test
        @DisplayName("Should return valid TokenInfo on success with all claims")
        void validate_success() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "access");
            claims.put("sub", "u-1");
            claims.put("username", "guest_u1");
            claims.put("role", "PLAYER");
            claims.put("jti", "jti-123");
            claims.put("iat", 1000L);
            claims.put("exp", 2000L);
            when(jwtPort.parseToken("tok")).thenReturn(claims);

            TokenInfo info = sessionService.validateAccessToken("tok");

            assertNotNull(info);
            assertAll(
                () -> assertEquals("u-1", info.getUserUuid()),
                () -> assertEquals("guest_u1", info.getUsername()),
                () -> assertEquals("PLAYER", info.getRole()),
                () -> assertEquals("access", info.getType()),
                () -> assertEquals("jti-123", info.getTokenId()),
                () -> assertEquals(1000L, info.getIssuedAt()),
                () -> assertEquals(2000L, info.getExpiresAt())
            );
        }

        @Test
        @DisplayName("Should handle iat/exp as Integer instead of Long")
        void validate_iatExpAsInteger() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "access");
            claims.put("sub", "u-1");
            claims.put("iat", 1234);  // Integer, not Long
            claims.put("exp", 5678);
            when(jwtPort.parseToken("tok")).thenReturn(claims);

            TokenInfo info = sessionService.validateAccessToken("tok");

            assertNotNull(info);
            assertEquals(1234L, info.getIssuedAt());
            assertEquals(5678L, info.getExpiresAt());
        }

        @Test
        @DisplayName("Should handle iat/exp as null (non-Number)")
        void validate_iatExpNull() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "access");
            claims.put("sub", "u-1");
            // iat and exp not in map — so they'll be null
            when(jwtPort.parseToken("tok")).thenReturn(claims);

            TokenInfo info = sessionService.validateAccessToken("tok");

            assertNotNull(info);
            assertEquals(0L, info.getIssuedAt());
            assertEquals(0L, info.getExpiresAt());
        }

        @Test
        @DisplayName("Should handle iat/exp as String (non-Number, should default to 0)")
        void validate_iatExpAsString() {
            when(jwtPort.validateToken("tok")).thenReturn(true);
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "access");
            claims.put("sub", "u-1");
            claims.put("iat", "not-a-number");
            claims.put("exp", "also-not");
            when(jwtPort.parseToken("tok")).thenReturn(claims);

            TokenInfo info = sessionService.validateAccessToken("tok");

            assertNotNull(info);
            assertEquals(0L, info.getIssuedAt());
            assertEquals(0L, info.getExpiresAt());
        }
    }
}
