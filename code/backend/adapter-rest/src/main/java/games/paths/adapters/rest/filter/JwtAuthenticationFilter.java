package games.paths.adapters.rest.filter;

import games.paths.core.model.auth.TokenInfo;
import games.paths.core.port.auth.SessionPort;

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

    public JwtAuthenticationFilter(SessionPort sessionPort, List<String> publicPaths, String adminPathPrefix) {
        this.sessionPort = sessionPort;
        this.publicPaths = publicPaths != null ? publicPaths : List.of();
        this.adminPathPrefix = adminPathPrefix != null ? adminPathPrefix : "/api/admin/";
        this.objectMapper = new ObjectMapper();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
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

        // Check admin authorization for admin paths
        if (isAdminPath(path) && !tokenInfo.isAdmin()) {
            sendForbidden(response, "FORBIDDEN", "Admin access required. Your role does not have permission.");
            return;
        }

        // Set user identity on the request for downstream controllers
        request.setAttribute("userUuid", tokenInfo.getUserUuid());
        request.setAttribute("username", tokenInfo.getUsername());
        request.setAttribute("role", tokenInfo.getRole());
        request.setAttribute("tokenId", tokenInfo.getTokenId());

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
