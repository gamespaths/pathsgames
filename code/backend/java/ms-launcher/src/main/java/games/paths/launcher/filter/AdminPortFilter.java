package games.paths.launcher.filter;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * AdminPortFilter - enforces a strict separation between the public listener and the
 * admin listener.
 *
 * <p>"Admin-only" paths are {@code /api/admin/**} and the dev-only maintenance endpoints
 * {@code /api/dev/**} (e.g. test-data seed/cleanup) — these are served ONLY on the admin
 * port so they sit behind the same IP boundary.</p>
 *
 * <ul>
 *   <li>On the <b>admin port</b> (default 8044): anything that is NOT admin-only returns 404
 *       — except the health-check endpoint {@code /api/echo/status}, which is also served on
 *       the admin port (same EchoService) so the admin endpoint can be monitored.</li>
 *   <li>On any <b>other port</b> (the public 8042 connector): any admin-only path returns 404.</li>
 * </ul>
 *
 * <p>404 (not 403) is used on purpose so the admin surface is invisible on the public
 * port and the public surface is invisible on the admin port. Admin-role authorization is
 * still enforced separately by {@code JwtAuthenticationFilter}.</p>
 */
public class AdminPortFilter implements Filter {

    /** Health-check path served on BOTH the public and the admin connector. */
    static final String ADMIN_HEALTH_PATH = "/api/echo/status";

    /** Dev-only maintenance endpoints, served ONLY on the admin port. */
    static final String DEV_PATH_PREFIX = "/api/dev";

    private final int adminPort;
    private final String adminPathPrefix;

    public AdminPortFilter(int adminPort, String adminPathPrefix) {
        this.adminPort = adminPort;
        this.adminPathPrefix = normalizePrefix(adminPathPrefix);
    }

    private static String normalizePrefix(String prefix) {
        if (prefix == null || prefix.isBlank()) {
            return "/api/admin";
        }
        // Match both "/api/admin/foo" and the bare "/api/admin" — strip a trailing slash.
        return prefix.endsWith("/") ? prefix.substring(0, prefix.length() - 1) : prefix;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String uri = httpRequest.getRequestURI();
        boolean onAdminPort = httpRequest.getLocalPort() == adminPort;
        // Admin-only = /api/admin/** and the dev maintenance endpoints /api/dev/**.
        boolean adminOnly = isAdminPath(uri) || isDevPath(uri);
        boolean healthPath = ADMIN_HEALTH_PATH.equals(uri);

        // On the admin port allow admin-only paths plus the health check; reject the rest.
        if (onAdminPort && !adminOnly && !healthPath) {
            reject(httpResponse, "This port only serves admin endpoints");
            return;
        }
        // On the public port reject admin-only paths.
        if (!onAdminPort && adminOnly) {
            reject(httpResponse, "Admin endpoints are served on the admin port only");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isAdminPath(String uri) {
        if (uri == null) {
            return false;
        }
        return uri.equals(adminPathPrefix) || uri.startsWith(adminPathPrefix + "/");
    }

    private boolean isDevPath(String uri) {
        if (uri == null) {
            return false;
        }
        return uri.equals(DEV_PATH_PREFIX) || uri.startsWith(DEV_PATH_PREFIX + "/");
    }

    private void reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"error\":\"NOT_FOUND\",\"message\":\"" + message + "\"}");
    }
}
