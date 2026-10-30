package games.paths.launcher.interceptor;

import games.paths.core.model.auth.UserStates;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;

/**
 * AdminHandlerInterceptor - v1.10.0 the last guard, on the handler Spring resolved (never on a path): an admin
 * controller answers only on the admin port and only to an ADMIN, a dev controller only on the admin port.
 */
public class AdminHandlerInterceptor implements HandlerInterceptor {

    static final String ADMIN_PACKAGE = "games.paths.adapters.admin.";
    static final String DEV_PACKAGE = "games.paths.adapters.rest.controller.dev.";

    private final int adminPort;

    public AdminHandlerInterceptor(int adminPort) {
        this.adminPort = adminPort;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        if (!(handler instanceof HandlerMethod method)) {
            return true;
        }
        String type = method.getBeanType().getName();
        boolean admin = type.startsWith(ADMIN_PACKAGE);
        if (!admin && !type.startsWith(DEV_PACKAGE)) {
            return true;
        }
        if (request.getLocalPort() != adminPort) {
            return refuse(response, HttpServletResponse.SC_NOT_FOUND, "NOT_FOUND",
                    "Admin endpoints are served on the admin port only");
        }
        // the role JwtAuthenticationFilter read from the database; dev endpoints are public on the admin port
        if (admin && !UserStates.ROLE_ADMIN.equals(request.getAttribute("role"))) {
            return refuse(response, HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN", "Admin access required");
        }
        return true;
    }

    private static boolean refuse(HttpServletResponse response, int status, String error, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + error + "\",\"message\":\"" + message + "\"}");
        return false;
    }
}
