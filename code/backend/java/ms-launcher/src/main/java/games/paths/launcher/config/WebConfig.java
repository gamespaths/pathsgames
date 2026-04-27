package games.paths.launcher.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WebConfig - CORS configuration for the REST API.
 * Allows the frontend to call backend endpoints from different origins.
 */
@Configuration
@ConfigurationProperties(prefix = "game.auth.cors")
public class WebConfig {

    @Value("${game.auth.cors.allowed-origins:http://localhost:3000}")
    private List<String> allowedOrigins = List.of("http://localhost:3000");
    // In questo modo, se Spring carica il bean, sovrascriverà questo campo con i
    // valori nel file application.yml (oppure manterrà il default di @Value),
    // mentre se la classe viene instanziata "manualmente" in un semplice Unit Test,
    // avrà comunque una lista valida e coerente con le aspettative del test.

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(@org.springframework.lang.NonNull CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOriginPatterns(String.join(",", allowedOrigins))
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }
}
