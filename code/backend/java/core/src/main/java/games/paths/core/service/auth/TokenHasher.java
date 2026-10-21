package games.paths.core.service.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

/**
 * TokenHasher - v1.2.0 SHA-256 (lowercase hex) of refresh tokens, guest cookie tokens and ID tokens.
 * Until {@link #LEGACY_FALLBACK_UNTIL} a clear value stored before 1.2.0 is still looked up.
 */
public final class TokenHasher {

    /** 180 days (the guest session length) after release 1.2.0: then the clear lookup stops. */
    public static final Instant LEGACY_FALLBACK_UNTIL = Instant.parse("2027-05-01T00:00:00Z");

    private TokenHasher() {
    }

    public static String sha256(String value) {
        if (value == null) {
            return null;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    /** The clear value for the lazy migration lookup, or null once the fallback window is over. */
    public static String legacy(String clearValue, Instant now) {
        return now.isBefore(LEGACY_FALLBACK_UNTIL) ? clearValue : null;
    }
}
