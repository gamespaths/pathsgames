package games.paths.core.service.auth;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;
import java.util.Locale;

/**
 * SubjectHasher - v1.7.0 HMAC-SHA256 (hex) of a banned Google subject or email with the stage pepper;
 * the email is trimmed and lowercased first. No rotation: one pepper per stage.
 */
public final class SubjectHasher {

    /** Committed default, accepted only in dev and test (StartupSecretsGuard). */
    public static final String DEFAULT_PEPPER = "PathsGamesDevBannedSubjectPepper2026";

    private final byte[] pepper;

    public SubjectHasher(String pepper) {
        String value = pepper == null || pepper.isBlank() ? DEFAULT_PEPPER : pepper;
        this.pepper = value.getBytes(StandardCharsets.UTF_8);
    }

    /** Null for a blank value, else the hex HMAC. */
    public String subject(String sub) {
        return sub == null || sub.isBlank() ? null : hmac(sub.trim());
    }

    public String email(String email) {
        return email == null || email.isBlank() ? null : hmac(email.trim().toLowerCase(Locale.ROOT));
    }

    String hmac(String value) {
        return hmac(value, "HmacSHA256");
    }

    /** v1.11.0 the algorithm as a parameter only so a test can reach the "unavailable" branch. */
    String hmac(String value, String algorithm) {
        try {
            Mac mac = Mac.getInstance(algorithm);
            mac.init(new SecretKeySpec(pepper, algorithm));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(algorithm + " unavailable", e);
        }
    }
}
