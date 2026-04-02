package games.paths.launcher.config;

import games.paths.adapters.rest.filter.JwtAuthenticationFilter;
import games.paths.core.port.auth.SessionPort;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * SecurityFilterConfig - Registers the JWT authentication filter as a servlet filter.
 * Configures which paths are public (no authentication required) and the admin path prefix.
 *
 * Public paths are defined in application.yml under game.auth.public-paths.
 * By default, includes Step 12 (guest auth) and Step 13 (echo, refresh) endpoints.
 */
@Configuration
public class SecurityFilterConfig {

    @Value("${game.auth.admin-path-prefix:/api/admin/}")
    private String adminPathPrefix;

    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtAuthenticationFilterRegistration(
            SessionPort sessionPort,
            @Value("${game.auth.public-paths:/api/echo/**,/api/auth/guest,/api/auth/guest/resume,/api/auth/refresh,/api/versions}")
            String publicPathsStr) {

        List<String> publicPaths = List.of(publicPathsStr.split(","));

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(sessionPort, publicPaths, adminPathPrefix);

        FilterRegistrationBean<JwtAuthenticationFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(filter);
        registrationBean.addUrlPatterns("/api/*");
        registrationBean.setOrder(1);
        registrationBean.setName("jwtAuthenticationFilter");
        return registrationBean;
    }
}
