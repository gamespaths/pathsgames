package games.paths.launcher.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** v1.10.0 {@link PathGuardFilter}: a non-canonical request path answers 400 INVALID_PATH. */
class PathGuardFilterTest {

    @Test
    @DisplayName("A needless escape answers 400 INVALID_PATH and stops the chain; a canonical path passes")
    void guard() throws Exception {
        PathGuardFilter filter = new PathGuardFilter();
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        StringWriter body = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(body));

        when(request.getRequestURI()).thenReturn("/api/%61dmin/users");
        filter.doFilter(request, response, chain);
        verify(response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
        verify(chain, never()).doFilter(any(), any());
        assertTrue(body.toString().contains("INVALID_PATH"));

        when(request.getRequestURI()).thenReturn("/api/admin/users/mario%40gmail.com");
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }
}
