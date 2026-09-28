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
 * SecurityHeadersFilter - v0.41.0 (Step 41 C): the API security headers on every response, both
 * ports, set before any other filter can answer. Auth and admin answers are never cached.
 */
public class SecurityHeadersFilter implements Filter {

    static final String CSP = "default-src 'none'; frame-ancestors 'none'";
    static final String HSTS = "max-age=31536000";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletResponse http = (HttpServletResponse) response;
        http.setHeader("X-Content-Type-Options", "nosniff");
        http.setHeader("X-Frame-Options", "DENY");
        http.setHeader("Referrer-Policy", "no-referrer");
        http.setHeader("Content-Security-Policy", CSP);
        http.setHeader("Strict-Transport-Security", HSTS);
        if (noStore(((HttpServletRequest) request).getRequestURI())) {
            http.setHeader("Cache-Control", "no-store");
        }
        chain.doFilter(request, response);
    }

    /** Public story reads stay cacheable; tokens and admin data never are. */
    static boolean noStore(String uri) {
        return uri != null && (uri.startsWith("/api/auth/") || uri.startsWith("/api/admin/")
                || "/api/auth".equals(uri) || "/api/admin".equals(uri));
    }
}
