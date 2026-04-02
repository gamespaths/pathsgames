package games.paths.adapters.auth.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link JwtTokenProvider}.
 * Verifies JWT generation, expiration logic, and claims integrity using the JJWT library.
 */
@ExtendWith(MockitoExtension.class)
class JwtTokenProviderTest {

    private static final String SECRET = "01234567890123456789012345678901"; // 32 chars per HS256
    private static final int ACCESS_MINUTES = 60;
    private static final int REFRESH_DAYS = 7;

    private JwtTokenProvider provider;
    private SecretKey key;

    @BeforeEach
    void setUp() {
        provider = new JwtTokenProvider(SECRET, ACCESS_MINUTES, REFRESH_DAYS);
        key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }

    // --- SEZIONE: GENERAZIONE TOKEN ---

    @Nested
    @DisplayName("Token Generation Tests")
    class GenerationTests {

        @Test
        @DisplayName("Should generate valid Access and Refresh tokens")
        void generateTokens_basicSanity() {
            // Act
            String access = provider.generateAccessToken("u-1", "guest1", "PLAYER");
            String refresh = provider.generateRefreshToken("u-1");

            // Assert
            assertAll("JWT Structure Checks",
                () -> assertNotNull(access),
                () -> assertNotNull(refresh),
                () -> assertEquals(3, access.split("\\.").length, "Access token should have 3 parts"),
                () -> assertEquals(3, refresh.split("\\.").length, "Refresh token should have 3 parts")
            );
        }

        @Test
        @DisplayName("Should contain correct claims in Access Token")
        void accessToken_containsCorrectClaims() {
            // Arrange
            String uuid = "user-uuid-123";
            String username = "test-guest";
            String role = "PLAYER";

            // Act
            String token = provider.generateAccessToken(uuid, username, role);

            // Parse using JJWT to verify content
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            // Assert
            assertAll("Verify Payload Claims",
                () -> assertEquals(uuid, claims.getSubject(), "Subject should be the UUID"),
                () -> assertEquals(username, claims.get("username")),
                () -> assertEquals(role, claims.get("role")),
                () -> assertNotNull(claims.getIssuedAt()),
                () -> assertNotNull(claims.getExpiration())
            );
        }
    }

    // --- SEZIONE: LOGICA SCADENZE ---

    @Nested
    @DisplayName("Expiration and Timing Tests")
    class ExpirationTests {

        @Test
        @DisplayName("Should calculate expiration timestamps correctly")
        void expirationTimestamps_logic() {
            long now = System.currentTimeMillis();
            
            long accessExp = provider.getAccessTokenExpirationMs();
            long refreshExp = provider.getRefreshTokenExpirationMs();

            assertAll("Check expiration ranges",
                () -> assertTrue(accessExp > now, "Access expiration must be in the future"),
                () -> assertTrue(refreshExp > accessExp, "Refresh expiration must be after access expiration"),
                // Verifica approssimativa (60 min = 3.600.000 ms)
                () -> assertTrue(accessExp <= now + (ACCESS_MINUTES * 60 * 1000L) + 5000) 
            );
        }

        @Test
        @DisplayName("Refresh token should have a longer lifespan than access token")
        void refreshToken_longLifespan() {
            String refresh = provider.generateRefreshToken("u-1");

            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(refresh)
                    .getPayload();

            long durationMs = claims.getExpiration().getTime() - claims.getIssuedAt().getTime();
            long expectedMs = REFRESH_DAYS * 24 * 60 * 60 * 1000L;

            // Delta di 2 secondi per tolleranza esecuzione
            assertEquals(expectedMs, durationMs, 2000, "Refresh duration should match configured days");
        }
    }

    // --- SEZIONE: PARSING TOKEN (Step 13) ---

    @Nested
    @DisplayName("Token Parsing Tests (Step 13)")
    class ParseTokenTests {

        @Test
        @DisplayName("Should parse valid access token and return expected claims")
        void parseToken_accessToken() {
            String token = provider.generateAccessToken("u-1", "guest_1", "PLAYER");
            Map<String, Object> claims = provider.parseToken(token);

            assertNotNull(claims);
            assertAll(
                () -> assertEquals("u-1", claims.get("sub")),
                () -> assertEquals("guest_1", claims.get("username")),
                () -> assertEquals("PLAYER", claims.get("role")),
                () -> assertEquals("access", claims.get("type")),
                () -> assertNotNull(claims.get("jti")),
                () -> assertNotNull(claims.get("iat")),
                () -> assertNotNull(claims.get("exp"))
            );
        }

        @Test
        @DisplayName("Should parse valid refresh token (username and role are null)")
        void parseToken_refreshToken() {
            String token = provider.generateRefreshToken("u-2");
            Map<String, Object> claims = provider.parseToken(token);

            assertNotNull(claims);
            assertAll(
                () -> assertEquals("u-2", claims.get("sub")),
                () -> assertEquals("refresh", claims.get("type")),
                () -> assertNull(claims.get("username")),
                () -> assertNull(claims.get("role"))
            );
        }

        @Test
        @DisplayName("Should return null for invalid/tampered token")
        void parseToken_invalidToken() {
            assertNull(provider.parseToken("not.a.valid.jwt"));
        }

        @Test
        @DisplayName("Should return null for null token")
        void parseToken_nullToken() {
            assertNull(provider.parseToken(null));
        }

        @Test
        @DisplayName("Should return null for token signed with different key")
        void parseToken_wrongKey() {
            JwtTokenProvider otherProvider = new JwtTokenProvider(
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345", ACCESS_MINUTES, REFRESH_DAYS);
            String token = otherProvider.generateAccessToken("u-1", "guest", "PLAYER");
            assertNull(provider.parseToken(token));
        }
    }

    // --- SEZIONE: VALIDAZIONE TOKEN (Step 13) ---

    @Nested
    @DisplayName("Token Validation Tests (Step 13)")
    class ValidateTokenTests {

        @Test
        @DisplayName("Should return true for valid access token")
        void validateToken_validAccess() {
            String token = provider.generateAccessToken("u-1", "guest_1", "PLAYER");
            assertTrue(provider.validateToken(token));
        }

        @Test
        @DisplayName("Should return true for valid refresh token")
        void validateToken_validRefresh() {
            String token = provider.generateRefreshToken("u-1");
            assertTrue(provider.validateToken(token));
        }

        @Test
        @DisplayName("Should return false for invalid/tampered token")
        void validateToken_invalidToken() {
            assertFalse(provider.validateToken("invalid.jwt.token"));
        }

        @Test
        @DisplayName("Should return false for null token")
        void validateToken_nullToken() {
            assertFalse(provider.validateToken(null));
        }

        @Test
        @DisplayName("Should return false for token signed with different key")
        void validateToken_wrongKey() {
            JwtTokenProvider otherProvider = new JwtTokenProvider(
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345", ACCESS_MINUTES, REFRESH_DAYS);
            String token = otherProvider.generateAccessToken("u-1", "guest", "PLAYER");
            assertFalse(provider.validateToken(token));
        }
    }
}