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
}