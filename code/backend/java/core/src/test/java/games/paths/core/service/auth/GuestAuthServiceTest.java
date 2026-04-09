package games.paths.core.service.auth;

import games.paths.core.model.auth.GuestSession;
import games.paths.core.port.auth.GuestPersistencePort;
import games.paths.core.port.auth.JwtPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link GuestAuthService}.
 * Ensures full coverage of the guest authentication flow, including session creation,
 * resumption via cookie tokens, and handling of expired or corrupted data.
 */
@ExtendWith(MockitoExtension.class)
class GuestAuthServiceTest {

    @Mock
    private JwtPort jwtPort;

    @Mock
    private GuestPersistencePort persistencePort;

    @InjectMocks
    private GuestAuthService guestAuthService;

    /**
     * Set up common mock behavior for token expiration timestamps.
     * Uses lenient() to avoid UnnecessaryStubbingException in tests that don't trigger these calls.
     */
    @BeforeEach
    void setUp() {
        lenient().when(jwtPort.getAccessTokenExpirationMs()).thenReturn(System.currentTimeMillis() + 3600000);
        lenient().when(jwtPort.getRefreshTokenExpirationMs()).thenReturn(System.currentTimeMillis() + 86400000);
    }

    // --- SECTION: GUEST SESSION CREATION ---

    @Nested
    @DisplayName("Create Guest Session Tests")
    class CreateSession {

        @Test
        @DisplayName("Should create, persist and return a valid new guest session")
        void createGuestSession_success() {
            // Arrange
            long mockUserId = 100L;
            when(persistencePort.createGuestUser(anyString(), anyString(), anyString(), anyString())).thenReturn(mockUserId);
            when(jwtPort.generateAccessToken(anyString(), anyString(), anyString())).thenReturn("access-token");
            when(jwtPort.generateRefreshToken(anyString())).thenReturn("refresh-token");

            // Act
            GuestSession session = guestAuthService.createGuestSession();

            // Assert
            assertAll("GuestSession creation validation",
                () -> assertNotNull(session),
                () -> assertTrue(session.getUsername().startsWith("guest_")),
                () -> assertEquals("access-token", session.getAccessToken()),
                () -> assertEquals("refresh-token", session.getRefreshToken())
            );
            
            // Verify persistence interactions
            verify(persistencePort).createGuestUser(eq(session.getUserUuid()), eq(session.getUsername()), anyString(), anyString());
            verify(persistencePort).storeRefreshToken(eq(mockUserId), eq("refresh-token"), anyString());
            verify(persistencePort).updateLastAccess(mockUserId);
        }
    }

    // --- SECTION: GUEST SESSION RESUMPTION ---

    @Nested
    @DisplayName("Resume Guest Session Tests")
    class ResumeSession {

        @Test
        @DisplayName("Should successfully resume session with a valid cookie token")
        void resumeGuestSession_success() {
            // Arrange
            String cookie = "valid-cookie";
            Map<String, Object> guestData = new HashMap<>();
            guestData.put("id", 100L);
            guestData.put("uuid", "u1");
            guestData.put("username", "guest_u1");
            guestData.put("guest_expires_at", Instant.now().plus(1, ChronoUnit.DAYS).toString());

            when(persistencePort.findGuestByCookieToken(cookie)).thenReturn(guestData);
            when(jwtPort.generateAccessToken(anyString(), anyString(), anyString())).thenReturn("new-access");
            when(jwtPort.generateRefreshToken(anyString())).thenReturn("new-refresh");

            // Act
            GuestSession session = guestAuthService.resumeGuestSession(cookie);

            // Assert
            assertNotNull(session);
            assertEquals("u1", session.getUserUuid());
            verify(persistencePort).updateLastAccess(100L);
            verify(persistencePort).storeRefreshToken(eq(100L), eq("new-refresh"), anyString());
        }

        @Test
        @DisplayName("Should return null if the session is expired (Branch Coverage)")
        void resumeGuestSession_expired() {
            // Arrange
            String cookie = "expired-cookie";
            String pastDate = Instant.now().minus(1, ChronoUnit.MINUTES).toString();
            Map<String, Object> guestData = Map.of(
                "id", 100L, "uuid", "u1", "username", "g1", "guest_expires_at", pastDate
            );
            when(persistencePort.findGuestByCookieToken(cookie)).thenReturn(new HashMap<>(guestData));

            // Act
            GuestSession session = guestAuthService.resumeGuestSession(cookie);

            // Assert
            assertNull(session);
            verify(jwtPort, never()).generateAccessToken(any(), any(), any());
        }

        @Test
        @DisplayName("Should return null if session exists but mandatory fields are missing (Sonar Coverage)")
        void resumeGuestSession_missingFields() {
            String cookie = "incomplete-data";
            
            // Branch 1: Missing userUuid
            when(persistencePort.findGuestByCookieToken(cookie)).thenReturn(new HashMap<>(Map.of("username", "g", "id", 1L)));
            assertNull(guestAuthService.resumeGuestSession(cookie));

            // Branch 2: Missing username
            when(persistencePort.findGuestByCookieToken(cookie)).thenReturn(new HashMap<>(Map.of("uuid", "u", "id", 1L)));
            assertNull(guestAuthService.resumeGuestSession(cookie));

            // Branch 3: Missing id
            when(persistencePort.findGuestByCookieToken(cookie)).thenReturn(new HashMap<>(Map.of("uuid", "u", "username", "g")));
            assertNull(guestAuthService.resumeGuestSession(cookie));
        }

        @Test
        @DisplayName("Should resume if expiresAtStr is null/missing (Support for permanent sessions)")
        void resumeGuestSession_nullExpiryDate() {
            String cookie = "no-expiry-token";
            Map<String, Object> guestData = new HashMap<>(Map.of("id", 100L, "uuid", "u1", "username", "g1"));

            when(persistencePort.findGuestByCookieToken(cookie)).thenReturn(guestData);
            when(jwtPort.generateAccessToken(any(), any(), any())).thenReturn("token");

            assertNotNull(guestAuthService.resumeGuestSession(cookie));
        }

        @Test
        @DisplayName("Should return null for invalid, null or unknown tokens")
        void resumeGuestSession_invalidToken() {
            assertNull(guestAuthService.resumeGuestSession(null));
            assertNull(guestAuthService.resumeGuestSession("  "));
            
            when(persistencePort.findGuestByCookieToken("unknown")).thenReturn(null);
            assertNull(guestAuthService.resumeGuestSession("unknown"));
        }
    }

    // --- SECTION: ADMINISTRATIVE TASKS ---

    @Test
    @DisplayName("Should delegate cleanup of expired sessions to persistence port")
    void cleanup_callsPersistence() {
        when(persistencePort.deleteExpiredGuests()).thenReturn(15);
        
        int result = guestAuthService.cleanupExpiredGuestSessions();
        
        assertEquals(15, result);
        verify(persistencePort).deleteExpiredGuests();
    }
}