package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.dto.GuestLoginResponse;
import games.paths.core.model.auth.GuestSession;
import games.paths.core.port.auth.GuestAuthPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GuestAuthController - REST adapter for guest authentication.
 * POST /api/auth/guest → creates a new guest session
 * POST /api/auth/guest/resume → resumes an existing guest session via cookie
 * token
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
     */
    @PostMapping("/guest")
    public ResponseEntity<GuestLoginResponse> createGuestSession() {
        GuestSession session = guestAuthPort.createGuestSession();

        GuestLoginResponse response = new GuestLoginResponse(
                session.getUserUuid(),
                session.getUsername(),
                session.getAccessToken(),
                session.getRefreshToken(),
                session.getAccessTokenExpiresAt(),
                session.getRefreshTokenExpiresAt(),
                session.getGuestCookieToken());

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * POST /api/auth/guest/resume
     * Resumes an existing guest session using the guest cookie token.
     * Request body: { "guestCookieToken": "..." }
     */
    @PostMapping("/guest/resume")
    public ResponseEntity<Object> resumeGuestSession(@RequestBody Map<String, String> request) {
        String cookieToken = request.get("guestCookieToken");

        if (cookieToken == null || cookieToken.isBlank()) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "MISSING_COOKIE_TOKEN");
            error.put("message", "guestCookieToken is required");
            return ResponseEntity.badRequest().body(error);
        }

        GuestSession session = guestAuthPort.resumeGuestSession(cookieToken);

        if (session == null) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "SESSION_EXPIRED_OR_NOT_FOUND");
            error.put("message", "Guest session is expired or does not exist. Please create a new guest session.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        }

        GuestLoginResponse response = new GuestLoginResponse(
                session.getUserUuid(),
                session.getUsername(),
                session.getAccessToken(),
                session.getRefreshToken(),
                session.getAccessTokenExpiresAt(),
                session.getRefreshTokenExpiresAt(),
                session.getGuestCookieToken());

        return ResponseEntity.ok(response);
    }
}
