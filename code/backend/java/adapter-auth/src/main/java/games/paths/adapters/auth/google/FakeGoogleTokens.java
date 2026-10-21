package games.paths.adapters.auth.google;

import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.GoogleIdentityClaims;
import games.paths.core.port.dev.FakeGoogleTokenPort;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * FakeGoogleTokens - v1.2.0 the test-only Google provider: HS256 tokens with kid "paths-games-fake-google"
 * signed by a key derived from the stage JWT secret, accepted only with the test endpoints enabled.
 */
public class FakeGoogleTokens implements FakeGoogleTokenPort {

    public static final String KID = "paths-games-fake-google";
    static final String DEFAULT_ISSUER = "https://accounts.google.com";
    private static final long DEFAULT_LIFETIME_SECONDS = 3600;

    private final boolean enabled;
    private final String clientId;
    private final SecretKey key;

    public FakeGoogleTokens(boolean enabled, String clientId, String jwtSecret) {
        this.enabled = enabled;
        this.clientId = clientId;
        this.key = Keys.hmacShaKeyFor(deriveKey(jwtSecret));
    }

    /** HMAC-SHA256(jwtSecret, "paths-games-fake-google"): the same on Java, Python and AWS. */
    static byte[] deriveKey(String jwtSecret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(KID.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 not available", e);
        }
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public String mint(Map<String, Object> claims) {
        if (!enabled) {
            throw new IllegalStateException("The fake Google provider is disabled");
        }
        Map<String, Object> c = new LinkedHashMap<>(claims == null ? Map.of() : claims);
        long now = Instant.now().getEpochSecond();
        long iat = now + longOf(c.remove("iatOffsetSeconds"), 0);
        long exp = now + longOf(c.remove("expOffsetSeconds"), DEFAULT_LIFETIME_SECONDS);
        c.putIfAbsent("iss", DEFAULT_ISSUER);
        c.putIfAbsent("aud", clientId);
        c.putIfAbsent("email_verified", Boolean.TRUE);
        // each minted token is unique, as Google's are (the replay check keys on the token hash)
        c.putIfAbsent("jti", java.util.UUID.randomUUID().toString());
        c.put("iat", iat);
        c.put("exp", exp);
        return Jwts.builder().header().keyId(KID).and().claims(c).signWith(key, Jwts.SIG.HS256).compact();
    }

    /** True when the token header names the fake key (decoded without verifying). */
    public static boolean isFake(String idToken) {
        if (idToken == null) {
            return false;
        }
        int dot = idToken.indexOf('.');
        if (dot <= 0) {
            return false;
        }
        try {
            String header = new String(Base64.getUrlDecoder().decode(idToken.substring(0, dot)), StandardCharsets.UTF_8);
            return header.contains("\"" + KID + "\"");
        } catch (IllegalArgumentException notBase64) {
            return false;
        }
    }

    /** Signature and expiry of a fake token; aud, iss and nonce are checked by the core service. */
    public GoogleIdentityClaims verify(String idToken) {
        if (!enabled) {
            throw new AuthException(AuthException.Code.INVALID_TOKEN, "Unknown Google token key");
        }
        try {
            Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(idToken).getPayload();
            String audience = c.getAudience() == null || c.getAudience().isEmpty() ? null
                    : c.getAudience().iterator().next();
            return new GoogleIdentityClaims(c.getSubject(), c.get("email", String.class),
                    Boolean.TRUE.equals(c.get("email_verified", Boolean.class)), c.get("name", String.class),
                    c.get("given_name", String.class), c.get("family_name", String.class),
                    c.get("picture", String.class), c.get("locale", String.class), c.get("nonce", String.class),
                    c.getIssuer(), audience, epoch(c.getExpiration()), epoch(c.getIssuedAt()));
        } catch (JwtException | IllegalArgumentException invalid) {
            throw new AuthException(AuthException.Code.INVALID_TOKEN, "The Google token is invalid or expired");
        }
    }

    private static long epoch(java.util.Date date) {
        return date == null ? 0 : date.toInstant().getEpochSecond();
    }

    private static long longOf(Object value, long fallback) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        if (value instanceof String s && !s.isBlank()) {
            try {
                return Long.parseLong(s.trim());
            } catch (NumberFormatException notANumber) {
                return fallback;
            }
        }
        return fallback;
    }
}
