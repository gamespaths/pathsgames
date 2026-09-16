package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.cookie.CookieHelper;
import games.paths.adapters.rest.dto.GuestLoginResponse;
import games.paths.core.model.auth.GuestSession;
import games.paths.core.port.auth.GuestAuthPort;
import games.paths.core.service.security.CsrfTokenService;
import games.paths.core.service.security.RateLimitService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GuestAuthController - REST adapter for guest authentication.
 *
 * <p>POST /api/auth/guest        → creates a new guest session</p>
 * <p>POST /api/auth/guest/resume → resumes an existing guest session via HttpOnly cookie</p>
 *
 * <p>Since v0.13.0-httponly the <b>refreshToken</b> and <b>guestCookieToken</b>
 * are no longer returned in the JSON response body.  They are set as HttpOnly
 * cookies so that JavaScript cannot read them (XSS blast-radius reduction).</p>
 */
@RestController
@RequestMapping("/api/auth")
public class GuestAuthController {

    static final String RATE_BUCKET = "guest";

    private final GuestAuthPort guestAuthPort;
    private final boolean testEndpointsEnabled;
    private final RateLimitService rateLimitService;
    private final int guestPerIp;
    private final CsrfTokenService csrfTokenService;

    public GuestAuthController(GuestAuthPort guestAuthPort,
                               @Value("${game.dev.test-endpoints-enabled:false}") boolean testEndpointsEnabled) {
        this(guestAuthPort, testEndpointsEnabled, null, 0, null);
    }

    /** v0.37.7 — Step 41: the guest bucket of the rate limiter and the CSRF token issuer. */
    @org.springframework.beans.factory.annotation.Autowired
    public GuestAuthController(GuestAuthPort guestAuthPort,
                               @Value("${game.dev.test-endpoints-enabled:false}") boolean testEndpointsEnabled,
                               RateLimitService rateLimitService,
                               @Value("${game.security.rate-limit.guest-per-ip:0}") int guestPerIp,
                               CsrfTokenService csrfTokenService) {
        this.guestAuthPort = guestAuthPort;
        this.testEndpointsEnabled = testEndpointsEnabled;
        this.rateLimitService = rateLimitService;
        this.guestPerIp = guestPerIp;
        this.csrfTokenService = csrfTokenService;
    }

    /**
     * POST /api/auth/guest
     * Creates a new anonymous guest session.
     * No request body required — the server generates the identity.
     * The refreshToken and guestCookieToken are set as HttpOnly cookies.
     *
     * <p>The optional {@code X-Test-Marker} header tags the generated guest so
     * it can later be removed by {@code POST /api/dev/cleanup}. It is honoured
     * only when dev test endpoints are enabled, and ignored in production.</p>
     */
    @PostMapping("/guest")
    public ResponseEntity<Object> createGuestSession(
            @RequestHeader(value = "X-Test-Marker", required = false) String testMarker,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        // Step 41 — at most guest-per-ip new guests per source address and window
        if (rateLimitService != null && guestPerIp > 0) {
            String ip = RateLimitService.clientIp(httpRequest.getHeader("X-Forwarded-For"),
                    httpRequest.getRemoteAddr());
            RateLimitService.Verdict verdict = rateLimitService.tryAcquire(RATE_BUCKET, ip, guestPerIp);
            if (!verdict.allowed()) {
                return rateLimited(verdict);
            }
        }
        String marker = testEndpointsEnabled ? testMarker : null;
        GuestSession session = guestAuthPort.createGuestSession(marker);

        // Set tokens in HttpOnly cookies (invisible to JavaScript)
        CookieHelper.setRefreshTokenCookie(httpResponse, session.getRefreshToken());
        CookieHelper.setGuestCookieToken(httpResponse, session.getGuestCookieToken());

        GuestLoginResponse response = new GuestLoginResponse(
                session.getUserUuid(),
                session.getUsername(),
                session.getAccessToken(),
                session.getAccessTokenExpiresAt(),
                session.getRefreshTokenExpiresAt());
        response.setCsrfToken(csrfTokenFor(session.getAccessToken()));

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * POST /api/auth/guest/resume
     * Resumes an existing guest session using the HttpOnly guestCookieToken cookie.
     * No request body required — the token is read from the cookie automatically.
     */
    @PostMapping("/guest/resume")
    public ResponseEntity<Object> resumeGuestSession(HttpServletRequest httpRequest,
                                                      HttpServletResponse httpResponse) {
        String cookieToken = CookieHelper.getGuestCookieToken(httpRequest);

        if (cookieToken == null || cookieToken.isBlank()) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "MISSING_COOKIE_TOKEN");
            error.put("message", "guestCookieToken cookie is required");
            return ResponseEntity.badRequest().body(error);
        }

        GuestSession session = guestAuthPort.resumeGuestSession(cookieToken);

        if (session == null) {
            // Stale cookie — remove it
            CookieHelper.deleteAllAuthCookies(httpResponse);
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "SESSION_EXPIRED_OR_NOT_FOUND");
            error.put("message", "Guest session is expired or does not exist. Please create a new guest session.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        }

        // Refresh both HttpOnly cookies
        CookieHelper.setRefreshTokenCookie(httpResponse, session.getRefreshToken());
        CookieHelper.setGuestCookieToken(httpResponse, session.getGuestCookieToken());

        GuestLoginResponse response = new GuestLoginResponse(
                session.getUserUuid(),
                session.getUsername(),
                session.getAccessToken(),
                session.getAccessTokenExpiresAt(),
                session.getRefreshTokenExpiresAt());
        response.setCsrfToken(csrfTokenFor(session.getAccessToken()));

        return ResponseEntity.ok(response);
    }

    private String csrfTokenFor(String accessToken) {
        return csrfTokenService == null ? null : csrfTokenService.tokenFor(accessToken);
    }

    private static ResponseEntity<Object> rateLimited(RateLimitService.Verdict verdict) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "RATE_LIMITED");
        body.put("message", "Too many guest sessions from this address, retry in "
                + verdict.retryAfterSeconds() + " seconds");
        body.put("retryAfterSeconds", verdict.retryAfterSeconds());
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(verdict.retryAfterSeconds()))
                .body(body);
    }
}
