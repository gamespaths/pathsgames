package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.cookie.CookieHelper;
import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.AuthenticatedSession;
import games.paths.core.model.auth.GoogleLoginCommand;
import games.paths.core.model.auth.UserProfile;
import games.paths.core.port.auth.GoogleLoginPort;
import games.paths.core.service.security.CsrfTokenService;
import games.paths.core.service.security.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GoogleAuthController - v1.2.0 POST /api/auth/google: a GIS ID token and its nonce for the usual
 * access token (body) and refresh cookie; the current guest (bearer or guest cookie) is merged.
 */
@RestController
@RequestMapping("/api/auth")
public class GoogleAuthController {

    static final String RATE_BUCKET = "google";

    private final GoogleLoginPort googleLoginPort;
    private final RateLimitService rateLimitService;
    private final int googlePerIp;
    private final CsrfTokenService csrfTokenService;

    public GoogleAuthController(GoogleLoginPort googleLoginPort, RateLimitService rateLimitService,
                                @Value("${game.security.rate-limit.google-per-ip:30}") int googlePerIp,
                                CsrfTokenService csrfTokenService) {
        this.googleLoginPort = googleLoginPort;
        this.rateLimitService = rateLimitService;
        this.googlePerIp = googlePerIp;
        this.csrfTokenService = csrfTokenService;
    }

    @PostMapping("/google")
    public ResponseEntity<Object> login(@RequestBody(required = false) Map<String, Object> body,
                                        HttpServletRequest request, HttpServletResponse response) {
        if (rateLimitService != null && googlePerIp > 0) {
            String ip = RateLimitService.clientIp(request.getHeader("X-Forwarded-For"), request.getRemoteAddr());
            RateLimitService.Verdict verdict = rateLimitService.tryAcquire(RATE_BUCKET, ip, googlePerIp);
            if (!verdict.allowed()) {
                ResponseEntity<Object> limited = AuthErrors.of(429, "RATE_LIMITED",
                        "Too many sign-in attempts from this address, retry in " + verdict.retryAfterSeconds()
                                + " seconds");
                return ResponseEntity.status(429).header("Retry-After", String.valueOf(verdict.retryAfterSeconds()))
                        .body(limited.getBody());
            }
        }
        Map<String, Object> b = body == null ? Map.of() : body;
        String header = request.getHeader("Authorization");
        String bearer = header != null && header.startsWith("Bearer ") ? header.substring(7).trim() : null;
        GoogleLoginCommand command = new GoogleLoginCommand(text(b.get("idToken")), text(b.get("nonce")),
                text(b.get("language")), bearer, CookieHelper.getGuestCookieToken(request));
        AuthenticatedSession session;
        try {
            session = googleLoginPort.login(command);
        } catch (AuthException e) {
            return AuthErrors.of(e);
        }
        CookieHelper.setRefreshTokenCookie(response, session.refreshToken());
        if (session.mergedGuestUuid() != null) {
            CookieHelper.deleteGuestCookieToken(response);
        }
        Map<String, Object> out = profileBody(session.profile());
        out.put("accessToken", session.accessToken());
        out.put("accessTokenExpiresAt", session.accessTokenExpiresAt());
        out.put("refreshTokenExpiresAt", session.refreshTokenExpiresAt());
        out.put("csrfToken", csrfTokenService == null ? null : csrfTokenService.tokenFor(session.accessToken()));
        out.put("newUser", session.newUser());
        out.put("mergedGuest", session.mergedGuestUuid() != null);
        out.put("cancelledMatches", session.cancelledMatches());
        return ResponseEntity.ok(out);
    }

    /** The profile fields shared with GET /api/auth/me. */
    static Map<String, Object> profileBody(UserProfile p) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userUuid", p.userUuid());
        out.put("username", p.username());
        out.put("nickname", p.nickname());
        out.put("displayName", p.displayName());
        out.put("pictureUrl", p.pictureUrl());
        out.put("role", p.role());
        out.put("accountType", p.accountType());
        out.put("language", p.language());
        return out;
    }

    private static String text(Object value) {
        return value instanceof String s ? s : null;
    }
}
