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
    @DisplayName("corsConfigurer() returns a non-null WebMvcConfigurer")
    void corsConfigurer_notNull() {
        WebConfig config = new WebConfig();
        WebMvcConfigurer configurer = config.corsConfigurer();

        assertNotNull(configurer);
    }

}
