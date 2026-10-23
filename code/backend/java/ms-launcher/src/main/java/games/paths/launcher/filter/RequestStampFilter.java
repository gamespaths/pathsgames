package games.paths.launcher.filter;

import games.paths.core.model.match.RequestStamp;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;

/**
 * RequestStampFilter - v1.7.0 opens one {@link RequestStamp} per request (with If-Match), so every match
 * write of the request stores the same ts_update; closed whatever the outcome.
 */
public class RequestStampFilter implements Filter {

    // v1.7.0 step 8 the match version the client is looking at
    static final String IF_MATCH = "If-Match";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        RequestStamp.open(request instanceof HttpServletRequest http ? http.getHeader(IF_MATCH) : null);
        try {
            chain.doFilter(request, response);
        } finally {
            RequestStamp.close();
        }
    }
}
