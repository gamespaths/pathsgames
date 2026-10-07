package games.paths.core.service.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * CsrfTokenService - Step 41: a stateless CSRF token bound to the access token it was issued with.
 * The token is HMAC-SHA256(secret, "csrf:" + accessToken), so nothing is stored and every backend agrees.
 */
public class CsrfTokenService {

    public static final String HEADER = "X-CSRF-TOKEN";
    private static final String ALGORITHM = "HmacSHA256";
    private static final String PREFIX = "csrf:";

    private final byte[] secret;
    private final boolean enforced;

    public CsrfTokenService(String secret, boolean enforced) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("CSRF secret must not be blank");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.enforced = enforced;
    }

    public boolean isEnforced() {
        return enforced;
    }

    /** The token a client must echo back in {@value #HEADER} while it holds this access token. */
    public String tokenFor(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            return null;
        }
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret, ALGORITHM));
            byte[] digest = mac.doFinal((PREFIX + accessToken.trim()).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }

    /** Constant-time comparison of what the client sent against what this access token deserves. */
    public boolean matches(String accessToken, String presented) {
        String expected = tokenFor(accessToken);
        if (expected == null || presented == null || presented.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                presented.trim().getBytes(StandardCharsets.UTF_8));
    }
}
