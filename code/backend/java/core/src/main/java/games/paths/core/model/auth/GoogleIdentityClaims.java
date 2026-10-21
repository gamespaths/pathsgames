package games.paths.core.model.auth;

/**
 * GoogleIdentityClaims - v1.2.0 the claims of a verified Google ID token (times in epoch seconds).
 * Personal fields are never logged: {@link #toString()} keeps only the subject.
 */
public record GoogleIdentityClaims(String subject, String email, boolean emailVerified, String name,
                                   String givenName, String familyName, String picture, String locale,
                                   String nonce, String issuer, String audience, long expiresAt,
                                   long issuedAt) {

    @Override
    public String toString() {
        return "GoogleIdentityClaims{subject='" + subject + "'}";
    }
}
