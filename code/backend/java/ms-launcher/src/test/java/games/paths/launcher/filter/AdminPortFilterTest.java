package games.paths.launcher.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AdminPortFilter} — verifies the strict public/admin port split.
 * Admin port: 8044. Public port: 8042.
 */
class AdminPortFilterTest {

    private static final int ADMIN_PORT = 8044;
    private static final int PUBLIC_PORT = 8042;

    private AdminPortFilter filter;
    private HttpServletRequest request;
    private HttpServletResponse response;
    private FilterChain chain;
    private StringWriter responseBody;

    @BeforeEach
    void setUp() throws Exception {
        filter = new AdminPortFilter(ADMIN_PORT, "/api/admin/");
        request = mock(HttpServletRequest.class);
        response = mock(HttpServletResponse.class);
        chain = mock(FilterChain.class);
        responseBody = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(responseBody));
    }

    @Test
    @DisplayName("Admin port + admin path → passes through")
    void adminPort_adminPath_passes() throws Exception {
        when(request.getLocalPort()).thenReturn(ADMIN_PORT);
        when(request.getRequestURI()).thenReturn("/api/admin/matches");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    @DisplayName("Admin port + non-admin path → 404, chain not called")
    void adminPort_publicPath_blocked() throws Exception {
        when(request.getLocalPort()).thenReturn(ADMIN_PORT);
        when(request.getRequestURI()).thenReturn("/api/stories");

        filter.doFilter(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_NOT_FOUND);
        verify(chain, never()).doFilter(any(), any());
        assertTrue(responseBody.toString().contains("NOT_FOUND"));
    }

    @Test
    @DisplayName("Public port + admin path → 404, chain not called")
    void publicPort_adminPath_blocked() throws Exception {
        when(request.getLocalPort()).thenReturn(PUBLIC_PORT);
        when(request.getRequestURI()).thenReturn("/api/admin/stories");

        filter.doFilter(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_NOT_FOUND);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("Admin port + /api/echo/status (health) → passes through")
    void adminPort_healthPath_passes() throws Exception {
        when(request.getLocalPort()).thenReturn(ADMIN_PORT);
        when(request.getRequestURI()).thenReturn("/api/echo/status");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    @DisplayName("Admin port + other echo path (not status) → 404")
    void adminPort_otherEchoPath_blocked() throws Exception {
        when(request.getLocalPort()).thenReturn(ADMIN_PORT);
        when(request.getRequestURI()).thenReturn("/api/echo/other");

        filter.doFilter(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_NOT_FOUND);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("Admin port + /api/dev/** (maintenance) → passes through")
    void adminPort_devPath_passes() throws Exception {
        when(request.getLocalPort()).thenReturn(ADMIN_PORT);
        when(request.getRequestURI()).thenReturn("/api/dev/cleanup");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    @DisplayName("Public port + /api/dev/** → 404 (dev endpoints are admin-only now)")
    void publicPort_devPath_blocked() throws Exception {
        when(request.getLocalPort()).thenReturn(PUBLIC_PORT);
        when(request.getRequestURI()).thenReturn("/api/dev/cleanup");

        filter.doFilter(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_NOT_FOUND);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("Public port + public path → passes through")
    void publicPort_publicPath_passes() throws Exception {
        when(request.getLocalPort()).thenReturn(PUBLIC_PORT);
        when(request.getRequestURI()).thenReturn("/api/matches");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    @DisplayName("Bare /api/admin (no trailing slash) is treated as admin on public port → 404")
    void publicPort_bareAdminPath_blocked() throws Exception {
        when(request.getLocalPort()).thenReturn(PUBLIC_PORT);
        when(request.getRequestURI()).thenReturn("/api/admin");

        filter.doFilter(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_NOT_FOUND);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("Path that merely starts with /api/admin... but is a different prefix is NOT admin")
    void publicPort_adminLookalikePath_passes() throws Exception {
        // "/api/administrators" must not be mistaken for an admin path.
        when(request.getLocalPort()).thenReturn(PUBLIC_PORT);
        when(request.getRequestURI()).thenReturn("/api/administrators");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Null/blank prefix falls back to /api/admin default")
    void nullPrefix_defaultsToApiAdmin() throws Exception {
        AdminPortFilter defaulted = new AdminPortFilter(ADMIN_PORT, null);
        when(request.getLocalPort()).thenReturn(PUBLIC_PORT);
        when(request.getRequestURI()).thenReturn("/api/admin/guests");

        defaulted.doFilter(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_NOT_FOUND);
    }
}
