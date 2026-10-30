package games.paths.launcher.config;

import games.paths.launcher.interceptor.AdminHandlerInterceptor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** AdminInterceptorConfig - v1.10.0 registers {@link AdminHandlerInterceptor} on every handler. */
@Configuration
public class AdminInterceptorConfig implements WebMvcConfigurer {

    @Value("${game.admin.port:8044}")
    private int adminPort;

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(new AdminHandlerInterceptor(adminPort));
    }
}
