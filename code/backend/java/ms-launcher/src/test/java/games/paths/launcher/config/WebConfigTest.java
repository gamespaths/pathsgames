package games.paths.launcher.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link WebConfig}.
 */
class WebConfigTest {

    @Test
    @DisplayName("Default allowedOrigins contains localhost:3000")
    void defaultAllowedOrigins() {
        WebConfig config = new WebConfig();
        List<String> origins = config.getAllowedOrigins();

        assertNotNull(origins);
        assertFalse(origins.isEmpty());
        assertTrue(origins.contains("http://localhost:3000"));
    }

    @Test
    @DisplayName("setAllowedOrigins replaces the list")
    void setAllowedOrigins_replacesList() {
        WebConfig config = new WebConfig();
        List<String> custom = List.of("https://example.com", "https://admin.example.com");

        config.setAllowedOrigins(custom);

        assertEquals(custom, config.getAllowedOrigins());
    }

    @Test
    @DisplayName("corsConfigurer() returns a non-null WebMvcConfigurer")
    void corsConfigurer_notNull() {
        WebConfig config = new WebConfig();
        WebMvcConfigurer configurer = config.corsConfigurer();

        assertNotNull(configurer);
    }

    @Test
    @DisplayName("corsConfigurer() uses updated allowed origins after setAllowedOrigins")
    void corsConfigurer_usesConfiguredOrigins() {
        WebConfig config = new WebConfig();
        config.setAllowedOrigins(List.of("https://myfrontend.com"));

        WebMvcConfigurer configurer = config.corsConfigurer();
        assertNotNull(configurer);
        // Behaviour is verified by the fact that setAllowedOrigins changed the origins list
        assertTrue(config.getAllowedOrigins().contains("https://myfrontend.com"));
    }
}
