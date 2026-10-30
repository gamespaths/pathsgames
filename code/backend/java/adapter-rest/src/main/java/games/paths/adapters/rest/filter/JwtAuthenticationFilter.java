package games.paths.adapters.rest.filter;

import games.paths.core.model.auth.TokenInfo;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.SessionPort;
import games.paths.core.port.auth.UserStatePort;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * JwtAuthenticationFilter - Servlet filter that validates JWT access tokens
 * on incoming HTTP requests. Sets user identity attributes on the request
 * for downstream controllers.
 *
 * Public paths (configured via constructor) skip authentication.
 * Admin paths require role=ADMIN.
 *
 * This filter does NOT use Spring Security — it operates as a simple
 * OncePerRequestFilter registered as a bean in the launcher configuration.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final SessionPort sessionPort;
    private final List<String> publicPaths;
    private final String adminPathPrefix;
    private final ObjectMapper objectMapper;
    private final UserStatePort userStatePort;

    public JwtAuthenticationFilter(SessionPort sessionPort, List<String> publicPaths, String adminPathPrefix) {
        this(sessionPort, publicPaths, adminPathPrefix, null);
    }

    /** v1.2.0 the user must exist; role and state come from the DB (60 s cache), never from the token. */
    public JwtAuthenticationFilter(SessionPort sessionPort, List<String> publicPaths, String adminPathPrefix,
                                   UserStatePort userStatePort) {
        this.userStatePort = userStatePort;
        this.sessionPort = sessionPort;
        this.publicPaths = publicPaths != null ? publicPaths : List.of();
        this.adminPathPrefix = adminPathPrefix != null ? adminPathPrefix : "/api/admin/";
        this.objectMapper = new ObjectMapper();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        // v1.10.0 the routed path (decoded, no ;parameters): public and admin checks see what Spring MVC routes
        String path = RequestPaths.routed(request);
        String method = request.getMethod();

        // Allow OPTIONS requests (CORS preflight) without authentication
        if ("OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check if the path is public
        if (isPublicPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Extract Bearer token from Authorization header
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            sendUnauthorized(response, "MISSING_TOKEN", "Authorization header with Bearer token is required");
            return;
        }

        String token = authHeader.substring(7).trim();
        if (token.isEmpty()) {
            sendUnauthorized(response, "EMPTY_TOKEN", "Bearer token is empty");
            return;
        }

        // Validate the access token
        TokenInfo tokenInfo = sessionPort.validateAccessToken(token);
        if (tokenInfo == null) {
            sendUnauthorized(response, "INVALID_TOKEN", "Access token is invalid, expired, or malformed");
            return;
        }

        if (userStatePort != null) {
            Optional<UserStatus> user = userStatePort.current(tokenInfo.userUuid());
            if (user.isEmpty()) {
                sendUnauthorized(response, "INVALID_TOKEN", "The user of this token does not exist");
                return;
            }
            int state = user.get().state();
            if (state == UserStates.BLOCKED || state == UserStates.BANNED) {
                sendForbidden(response, "ACCOUNT_DISABLED", "The account is disabled");
                return;
            }
            if (state == UserStates.DELETING) {
                sendForbidden(response, "ACCOUNT_DELETION_IN_PROGRESS", "The account is being deleted");
                return;
            }
            // v1.7.0 issued before "log out of all devices", a ban or a suspension (seconds, 60 s cache)
            if (!user.get().acceptsTokenIssuedAt(tokenInfo.issuedAt() / 1000)) {
                sendUnauthorized(response, "SESSION_REVOKED", "The session was closed from another device");
                return;
            }
            tokenInfo = new TokenInfo(tokenInfo.userUuid(), user.get().username(), user.get().role(),
                    tokenInfo.type(), tokenInfo.tokenId(), tokenInfo.issuedAt(), tokenInfo.expiresAt());
        }

        // Check admin authorization for admin paths
        if (isAdminPath(path) && !tokenInfo.isAdmin()) {
            sendForbidden(response, "FORBIDDEN", "Admin access required. Your role does not have permission.");
            return;
        }

        // Set user identity on the request for downstream controllers
        request.setAttribute("userUuid", tokenInfo.userUuid());
        request.setAttribute("username", tokenInfo.username());
        request.setAttribute("role", tokenInfo.role());
        request.setAttribute("tokenId", tokenInfo.tokenId());

        filterChain.doFilter(request, response);
    }

    /**
     * Checks if the request path matches any configured public path pattern.
     * Supports exact match and wildcard suffix (/**).
     */
    boolean isPublicPath(String path) {
        if (path == null) {
            return false;
        }
        for (String publicPath : publicPaths) {
            if (publicPath.endsWith("/**")) {
                String prefix = publicPath.substring(0, publicPath.length() - 3);
                if (path.equals(prefix) || path.startsWith(prefix + "/")) {
                    return true;
                }
            } else if (path.equals(publicPath)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks if the request path is an admin-protected path.
     */
    boolean isAdminPath(String path) {
        return path != null && path.startsWith(adminPathPrefix);
    }

    private void sendUnauthorized(HttpServletResponse response, String error, String message) throws IOException {
        sendError(response, HttpServletResponse.SC_UNAUTHORIZED, error, message);
    }

    private void sendForbidden(HttpServletResponse response, String error, String message) throws IOException {
        sendError(response, HttpServletResponse.SC_FORBIDDEN, error, message);
    }

    private void sendError(HttpServletResponse response, int status, String error, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", error);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());

        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
