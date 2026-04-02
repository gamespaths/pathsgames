package games.paths.adapters.rest.controller.auth;

import games.paths.adapters.rest.dto.RefreshTokenRequest;
import games.paths.adapters.rest.dto.RefreshTokenResponse;
import games.paths.core.model.auth.RefreshedSession;
import games.paths.core.model.auth.TokenInfo;
import games.paths.core.port.auth.SessionPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * SessionController - REST adapter for session and token management.
 * Handles token refresh (with rotation), logout, and user info retrieval.
 *
 * POST /api/auth/refresh     → exchange refresh token for new token pair
 * POST /api/auth/logout      → revoke a single refresh token
 * POST /api/auth/logout/all  → revoke all sessions for the authenticated user
 * GET  /api/auth/me          → get current user info from valid access token
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
     */
    @PostMapping("/refresh")
    public ResponseEntity<Object> refreshToken(@RequestBody RefreshTokenRequest request) {
        if (request.getRefreshToken() == null || request.getRefreshToken().isBlank()) {
            return errorResponse(HttpStatus.BAD_REQUEST, "MISSING_REFRESH_TOKEN",
                    "refreshToken is required");
        }

        RefreshedSession session = sessionPort.refreshToken(request.getRefreshToken());

        if (session == null) {
            return errorResponse(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN",
                    "Refresh token is invalid, expired, or revoked. Please login again.");
        }

        RefreshTokenResponse response = new RefreshTokenResponse(
                session.getUserUuid(),
                session.getUsername(),
                session.getRole(),
                session.getAccessToken(),
                session.getRefreshToken(),
                session.getAccessTokenExpiresAt(),
                session.getRefreshTokenExpiresAt());

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/auth/logout
     * Revokes a single refresh token (logout from one device/channel).
     * Requires a valid access token in the Authorization header.
     */
    @PostMapping("/logout")
    public ResponseEntity<Object> logout(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            return errorResponse(HttpStatus.BAD_REQUEST, "MISSING_REFRESH_TOKEN",
                    "refreshToken is required");
        }

        boolean revoked = sessionPort.logout(refreshToken);

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
    public ResponseEntity<Object> logoutAll(jakarta.servlet.http.HttpServletRequest httpRequest) {
        String userUuid = (String) httpRequest.getAttribute("userUuid");

        if (userUuid == null || userUuid.isBlank()) {
            return errorResponse(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED",
                    "Valid access token required");
        }

        boolean revoked = sessionPort.revokeAllSessions(userUuid);

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
    public ResponseEntity<Object> getCurrentUser(jakarta.servlet.http.HttpServletRequest httpRequest) {
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
