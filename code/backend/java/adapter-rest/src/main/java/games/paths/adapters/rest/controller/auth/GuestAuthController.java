package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.cookie.CookieHelper;
import games.paths.adapters.rest.dto.GuestLoginResponse;
import games.paths.core.model.auth.GuestSession;
import games.paths.core.port.auth.GuestAuthPort;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

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

    private final GuestAuthPort guestAuthPort;

    public GuestAuthController(GuestAuthPort guestAuthPort) {
        this.guestAuthPort = guestAuthPort;
    }

    /**
     * POST /api/auth/guest
     * Creates a new anonymous guest session.
     * No request body required — the server generates the identity.
     * The refreshToken and guestCookieToken are set as HttpOnly cookies.
     */
    @PostMapping("/guest")
    public ResponseEntity<GuestLoginResponse> createGuestSession(HttpServletResponse httpResponse) {
        GuestSession session = guestAuthPort.createGuestSession();

        // Set tokens in HttpOnly cookies (invisible to JavaScript)
        CookieHelper.setRefreshTokenCookie(httpResponse, session.getRefreshToken());
        CookieHelper.setGuestCookieToken(httpResponse, session.getGuestCookieToken());

        GuestLoginResponse response = new GuestLoginResponse(
                session.getUserUuid(),
                session.getUsername(),
                session.getAccessToken(),
                session.getAccessTokenExpiresAt(),
                session.getRefreshTokenExpiresAt());

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

        return ResponseEntity.ok(response);
    }
}
