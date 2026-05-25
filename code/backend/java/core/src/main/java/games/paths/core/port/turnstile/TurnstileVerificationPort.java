package games.paths.core.port.turnstile;

/**
 * TurnstileVerificationPort - Outbound port for Cloudflare Turnstile token verification.
 * Implementations call the Cloudflare siteverify API; when no secret key is configured
 * the implementation should bypass validation and return {@code true}.
 */
public interface TurnstileVerificationPort {

    /**
     * Verifies a Turnstile challenge token.
     *
     * @param token    the token received from the client widget (may be null)
     * @param remoteIp the client IP address (optional, may be null)
     * @return {@code true} when the token is valid or verification is disabled
     */
    boolean verify(String token, String remoteIp);
}
