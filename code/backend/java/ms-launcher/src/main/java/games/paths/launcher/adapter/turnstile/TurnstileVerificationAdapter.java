package games.paths.launcher.adapter.turnstile;

import games.paths.core.port.turnstile.TurnstileVerificationPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * TurnstileVerificationAdapter - Calls the Cloudflare Turnstile siteverify API.
 * Bypasses verification when:
 *   - no secret key is configured (empty/null) — dev default, or
 *   - env is not "prod" AND a bypass token is configured AND the incoming
 *     token matches it (used by Robot tests against an env with a real key).
 */
public class TurnstileVerificationAdapter implements TurnstileVerificationPort {

    private static final String SITEVERIFY_URL =
            "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    private final String secretKey;
    private final String bypassToken;
    private final String env;
    private final RestTemplate restTemplate;

    public TurnstileVerificationAdapter(String secretKey, RestTemplate restTemplate) {
        this(secretKey, "", "dev", restTemplate);
    }

    public TurnstileVerificationAdapter(String secretKey,
                                        String bypassToken,
                                        String env,
                                        RestTemplate restTemplate) {
        this.secretKey = secretKey;
        this.bypassToken = bypassToken == null ? "" : bypassToken;
        this.env = env == null ? "dev" : env;
        this.restTemplate = restTemplate;
    }

    @Override
    public boolean verify(String token, String remoteIp) {
        if (secretKey == null || secretKey.isBlank()) {
            return true;
        }
        if (!"prod".equals(env) && !bypassToken.isEmpty() && bypassToken.equals(token)) {
            return true;
        }
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("secret", secretKey);
            body.add("response", token);
            if (remoteIp != null && !remoteIp.isBlank()) {
                body.add("remoteip", remoteIp);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                    SITEVERIFY_URL,
                    new HttpEntity<>(body, headers),
                    Map.class);

            return response != null && Boolean.TRUE.equals(response.get("success"));
        } catch (Exception e) {
            return false;
        }
    }
}
