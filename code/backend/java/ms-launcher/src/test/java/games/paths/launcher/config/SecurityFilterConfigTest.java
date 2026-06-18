package games.paths.launcher.config;

import games.paths.adapters.rest.filter.JwtAuthenticationFilter;
import games.paths.core.port.auth.SessionPort;
import games.paths.launcher.filter.AdminPortFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.servlet.FilterRegistrationBean;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link SecurityFilterConfig}.
 * Verifies filter registration bean creation and configuration.
 */
@ExtendWith(MockitoExtension.class)
class SecurityFilterConfigTest {

    @Mock
    private SessionPort sessionPort;

    @Test
    @DisplayName("Should create FilterRegistrationBean with correct configuration")
    void filterRegistration_createsBean() throws Exception {
        SecurityFilterConfig config = new SecurityFilterConfig();
        // Set adminPathPrefix via reflection since it's a @Value
        Field adminField = SecurityFilterConfig.class.getDeclaredField("adminPathPrefix");
        adminField.setAccessible(true);
        adminField.set(config, "/api/admin/");

        FilterRegistrationBean<JwtAuthenticationFilter> bean =
                config.jwtAuthenticationFilterRegistration(
                        sessionPort,
                        "/api/echo/**,/api/auth/guest,/api/auth/refresh");

        assertNotNull(bean);
        assertNotNull(bean.getFilter());
        assertTrue(bean.getFilter() instanceof JwtAuthenticationFilter);
        assertEquals(1, bean.getOrder());
        assertTrue(bean.getUrlPatterns().contains("/api/*"));
    }

    @Test
    @DisplayName("Should register AdminPortFilter at order 0 for all paths")
    void adminPortFilterRegistration_createsBean() throws Exception {
        SecurityFilterConfig config = new SecurityFilterConfig();
        Field adminPrefix = SecurityFilterConfig.class.getDeclaredField("adminPathPrefix");
        adminPrefix.setAccessible(true);
        adminPrefix.set(config, "/api/admin/");
        Field adminPort = SecurityFilterConfig.class.getDeclaredField("adminPort");
        adminPort.setAccessible(true);
        adminPort.setInt(config, 8044);

        FilterRegistrationBean<AdminPortFilter> bean = config.adminPortFilterRegistration();

        assertNotNull(bean);
        assertTrue(bean.getFilter() instanceof AdminPortFilter);
        assertEquals(0, bean.getOrder());
        assertTrue(bean.getUrlPatterns().contains("/*"));
    }
}
