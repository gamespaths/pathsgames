package games.paths.core.model.auth;

/**
 * GoogleLoginCommand - v1.2.0 POST /api/auth/google: the GIS ID token, the login nonce, the
 * language preferred by the device and the current guest session (bearer or guest cookie), if any.
 */
public record GoogleLoginCommand(String idToken, String nonce, String language, String guestAccessToken,
                                 String guestCookieToken) {

    @Override
    public String toString() {
        return "GoogleLoginCommand{language='" + language + "'}";
    }
}
