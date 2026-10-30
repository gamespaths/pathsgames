package games.paths.launcher.interceptor;

import games.paths.adapters.admin.probe.ProbeAdminController;
import games.paths.launcher.config.AdminInterceptorConfig;
import games.paths.launcher.filter.AdminPortFilter;
import games.paths.launcher.filter.PathGuardFilter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

import java.net.URI;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * v1.10.0 the admin-path bypass of 1.9.0 (/api/%61dmin routed by Spring to an admin controller while the
 * filters compared the raw URI): each layer alone refuses it, the interceptor on the resolved handler.
 */
class AdminHandlerInterceptorTest {

    private static final int ADMIN_PORT = 8044;

    private static RequestPostProcessor on(int port, String role) {
        return r -> {
            r.setLocalPort(port);
            if (role != null) {
                r.setAttribute("role", role);
            }
            return r;
        };
    }

    @Test
    @DisplayName("Interceptor alone: Spring routes /api/%61dmin to the admin handler, the public port gets 404")
    void interceptorOnTheResolvedHandler() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new ProbeAdminController())
                .addInterceptors(new AdminHandlerInterceptor(ADMIN_PORT)).build();
        mvc.perform(get(URI.create("/api/%61dmin/probe")).with(on(8042, "ADMIN")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("NOT_FOUND"));
        mvc.perform(get(URI.create("/api/admin/probe")).with(on(ADMIN_PORT, "PLAYER")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN"));
        mvc.perform(get(URI.create("/api/admin/probe")).with(on(ADMIN_PORT, null)))
                .andExpect(status().isForbidden());
        mvc.perform(get(URI.create("/api/admin/probe")).with(on(ADMIN_PORT, "ADMIN")))
                .andExpect(status().isOk()).andExpect(content().string("admin"));
    }

    @Test
    @DisplayName("Filters: the guard answers 400, the port filter on the routed path 404")
    void filtersRefuseTheEncodedPath() throws Exception {
        MockMvc guarded = MockMvcBuilders.standaloneSetup(new ProbeAdminController())
                .addFilters(new PathGuardFilter()).build();
        guarded.perform(get(URI.create("/api/%61dmin/probe")).with(on(8042, "ADMIN")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_PATH"));
        MockMvc ported = MockMvcBuilders.standaloneSetup(new ProbeAdminController())
                .addFilters(new AdminPortFilter(ADMIN_PORT, "/api/admin")).build();
        ported.perform(get(URI.create("/api/%61dmin/probe")).with(on(8042, "ADMIN")))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Dev handlers need only the admin port; other handlers and non-method handlers pass")
    void devAndOtherHandlers() throws Exception {
        AdminHandlerInterceptor interceptor = new AdminHandlerInterceptor(ADMIN_PORT);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(response.getWriter()).thenReturn(new java.io.PrintWriter(new java.io.StringWriter()));
        Object dev = new org.springframework.web.method.HandlerMethod(
                new games.paths.adapters.rest.controller.dev.DevController(null, true),
                games.paths.adapters.rest.controller.dev.DevController.class.getMethod("cleanup"));
        when(request.getLocalPort()).thenReturn(ADMIN_PORT);
        assertTrue(interceptor.preHandle(request, response, dev));
        when(request.getLocalPort()).thenReturn(8042);
        assertFalse(interceptor.preHandle(request, response, dev));
        Object echo = new org.springframework.web.method.HandlerMethod(this,
                AdminHandlerInterceptorTest.class.getDeclaredMethod("devAndOtherHandlers"));
        assertTrue(interceptor.preHandle(request, response, echo));
        assertTrue(interceptor.preHandle(request, response, new Object()));
    }

    @Test
    @DisplayName("The config registers the interceptor")
    void configRegistersTheInterceptor() {
        InterceptorRegistry registry = mock(InterceptorRegistry.class);
        new AdminInterceptorConfig().addInterceptors(registry);
        verify(registry).addInterceptor(any(AdminHandlerInterceptor.class));
    }
}
