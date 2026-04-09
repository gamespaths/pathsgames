package games.paths.adapters.auth.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import games.paths.core.port.auth.JwtPort;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * JwtTokenProvider - Adapter implementing JWT token generation, parsing, and validation.
 * Uses HMAC-SHA256 signing with a configurable secret key.
 */
@Component
public class JwtTokenProvider implements JwtPort {

    private final SecretKey signingKey;
    private final long accessTokenMinutes;
    private final long refreshTokenDays;

        public JwtTokenProvider(
            @Value("${game.auth.jwt.secret:0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF}") String secret,
            @Value("${game.auth.jwt.access-token-minutes:30}") long accessTokenMinutes,
            @Value("${game.auth.jwt.refresh-token-days:7}") long refreshTokenDays) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenMinutes = accessTokenMinutes;
        this.refreshTokenDays = refreshTokenDays;
    }

    @Override
    public String generateAccessToken(String userUuid, String username, String role) {
        Instant now = Instant.now();
        Instant expiration = now.plus(accessTokenMinutes, ChronoUnit.MINUTES);

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(userUuid)
                .claim("username", username)
                .claim("role", role)
                .claim("type", "access")
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(signingKey)
                .compact();
    }

    @Override
    public String generateRefreshToken(String userUuid) {
        Instant now = Instant.now();
        Instant expiration = now.plus(refreshTokenDays, ChronoUnit.DAYS);

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(userUuid)
                .claim("type", "refresh")
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(signingKey)
                .compact();
    }

    @Override
    public long getAccessTokenExpirationMs() {
        return Instant.now().plus(accessTokenMinutes, ChronoUnit.MINUTES).toEpochMilli();
    }

    @Override
    public long getRefreshTokenExpirationMs() {
        return Instant.now().plus(refreshTokenDays, ChronoUnit.DAYS).toEpochMilli();
    }

    @Override
    public Map<String, Object> parseToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("sub", claims.getSubject());
            result.put("jti", claims.getId());
            result.put("username", claims.get("username", String.class));
            result.put("role", claims.get("role", String.class));
            result.put("type", claims.get("type", String.class));

            if (claims.getIssuedAt() != null) {
                result.put("iat", claims.getIssuedAt().getTime());
            }
            if (claims.getExpiration() != null) {
                result.put("exp", claims.getExpiration().getTime());
            }

            return result;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
