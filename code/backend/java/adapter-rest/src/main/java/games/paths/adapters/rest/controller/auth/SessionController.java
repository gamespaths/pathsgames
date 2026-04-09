package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.cookie.CookieHelper;
import games.paths.adapters.rest.dto.RefreshTokenResponse;
import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.port.auth.SessionPort;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * SessionController - REST adapter for session and token management.
 * Handles token refresh (with rotation), logout, and user info retrieval.
 *
 * <p>Since v0.13.0-httponly the <b>refreshToken</b> is read from / written
 * to an HttpOnly cookie ({@code pathsgames.refreshToken}) instead of the
 * JSON request/response body.  This eliminates the XSS blast radius for
 * refresh tokens.</p>
 *
 * <ul>
 *   <li>POST /api/auth/refresh     → exchange refresh token (cookie) for new token pair</li>
 *   <li>POST /api/auth/logout      → revoke the refresh token (cookie) and delete cookies</li>
 *   <li>POST /api/auth/logout/all  → revoke all sessions for the authenticated user</li>
 *   <li>GET  /api/auth/me          → get current user info from valid access token</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/auth")
public class SessionController {

    private final SessionPort sessionPort;

    public SessionController(SessionPort sessionPort) {
        this.sessionPort = sessionPort;
    }

    /**
     * POST /api/auth/refresh
     * Exchanges a valid refresh token for a new access + refresh token pair.
     * Token rotation: revokes ALL previous tokens for the user.
     *
     * <p>The refresh token is read from the HttpOnly cookie
     * {@code pathsgames.refreshToken}. The new refresh token is set as a
     * new HttpOnly cookie in the response.</p>
     */
    @PostMapping("/refresh")
    public ResponseEntity<Object> refreshToken(HttpServletRequest httpRequest,
                                                HttpServletResponse httpResponse) {
        String refreshToken = CookieHelper.getRefreshToken(httpRequest);

        if (refreshToken == null || refreshToken.isBlank()) {
            return errorResponse(HttpStatus.BAD_REQUEST, "MISSING_REFRESH_TOKEN",
                    "refreshToken cookie is required");
        }

        RefreshedSession session = sessionPort.refreshToken(refreshToken);

        if (session == null) {
            // Token is invalid/expired — delete the stale cookie
            CookieHelper.deleteRefreshTokenCookie(httpResponse);
            return errorResponse(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN",
                    "Refresh token is invalid, expired, or revoked. Please login again.");
        }

        // Set the new refresh token as an HttpOnly cookie
        CookieHelper.setRefreshTokenCookie(httpResponse, session.getRefreshToken());

        RefreshTokenResponse response = new RefreshTokenResponse(
                session.getUserUuid(),
                session.getUsername(),
                session.getRole(),
                session.getAccessToken(),
                session.getAccessTokenExpiresAt(),
                session.getRefreshTokenExpiresAt());

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/auth/logout
     * Revokes a single refresh token (logout from one device/channel).
     * Requires a valid access token in the Authorization header.
     *
     * <p>The refresh token is read from the HttpOnly cookie. Both auth
     * cookies are deleted from the response.</p>
     */
    @PostMapping("/logout")
    public ResponseEntity<Object> logout(HttpServletRequest httpRequest,
                                          HttpServletResponse httpResponse) {
        String refreshToken = CookieHelper.getRefreshToken(httpRequest);

        if (refreshToken == null || refreshToken.isBlank()) {
            // No cookie — still clear any leftovers and report OK
            CookieHelper.deleteAllAuthCookies(httpResponse);
            return errorResponse(HttpStatus.BAD_REQUEST, "MISSING_REFRESH_TOKEN",
                    "refreshToken cookie is required");
        }

        boolean revoked = sessionPort.logout(refreshToken);

        // Always delete cookies on logout, regardless of revocation result
        CookieHelper.deleteAllAuthCookies(httpResponse);

        Map<String, Object> result = new LinkedHashMap<>();
        if (revoked) {
            result.put("status", "OK");
            result.put("message", "Token revoked successfully");
            result.put("timestamp", System.currentTimeMillis());
            return ResponseEntity.ok(result);
        } else {
            return errorResponse(HttpStatus.NOT_FOUND, "TOKEN_NOT_FOUND",
                    "Refresh token not found or already revoked");
        }
    }

    /**
     * POST /api/auth/logout/all
     * Revokes all active sessions for the authenticated user.
     * Requires a valid access token in the Authorization header.
     * The user UUID is extracted from the JWT by the authentication filter.
     */
    @PostMapping("/logout/all")
    public ResponseEntity<Object> logoutAll(HttpServletRequest httpRequest,
                                             HttpServletResponse httpResponse) {
        String userUuid = (String) httpRequest.getAttribute("userUuid");

        if (userUuid == null || userUuid.isBlank()) {
            return errorResponse(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED",
                    "Valid access token required");
        }

        boolean revoked = sessionPort.revokeAllSessions(userUuid);

        // Delete all auth cookies when revoking all sessions
        CookieHelper.deleteAllAuthCookies(httpResponse);

        Map<String, Object> result = new LinkedHashMap<>();
        if (revoked) {
            result.put("status", "OK");
            result.put("message", "All sessions revoked successfully");
            result.put("timestamp", System.currentTimeMillis());
            return ResponseEntity.ok(result);
        } else {
            return errorResponse(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
                    "User not found");
        }
    }

    /**
     * GET /api/auth/me
     * Returns the current user's identity information from the valid access token.
     * Requires a valid access token in the Authorization header.
     */
    @GetMapping("/me")
    public ResponseEntity<Object> getCurrentUser(HttpServletRequest httpRequest) {
        String userUuid = (String) httpRequest.getAttribute("userUuid");

        if (userUuid == null || userUuid.isBlank()) {
            return errorResponse(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED",
                    "Valid access token required");
        }

        Map<String, Object> userInfo = new LinkedHashMap<>();
        userInfo.put("userUuid", userUuid);
        userInfo.put("username", httpRequest.getAttribute("username"));
        userInfo.put("role", httpRequest.getAttribute("role"));
        userInfo.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.ok(userInfo);
    }

    // === Helper ===

    private ResponseEntity<Object> errorResponse(HttpStatus status, String error, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", error);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }
}
