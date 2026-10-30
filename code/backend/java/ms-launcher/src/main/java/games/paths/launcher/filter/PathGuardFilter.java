package games.paths.launcher.filter;

import games.paths.adapters.rest.filter.RequestPaths;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * PathGuardFilter - v1.10.0 first filter of both ports: a request URI that the filters could read differently
 * from Spring MVC (';', '\', dot segments, needless escapes such as /api/%61dmin) answers 400 INVALID_PATH.
 */
public class PathGuardFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        if (RequestPaths.isSuspicious(httpRequest.getRequestURI())) {
            HttpServletResponse httpResponse = (HttpServletResponse) response;
            httpResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            httpResponse.setContentType("application/json");
            httpResponse.getWriter().write(
                    "{\"error\":\"INVALID_PATH\",\"message\":\"The request path is not in canonical form\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
