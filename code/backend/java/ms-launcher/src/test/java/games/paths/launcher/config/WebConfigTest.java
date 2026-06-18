package games.paths.launcher.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

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

    @Test
    @DisplayName("Each allowed origin is registered as a SEPARATE pattern (not one comma-joined string)")
    void corsConfigurer_registersEachOriginAsSeparatePattern() throws Exception {
        WebConfig config = new WebConfig();
        List<String> origins = List.of(
                "https://paths.games", "https://www.paths.games", "https://test.paths.games");

        Field f = WebConfig.class.getDeclaredField("allowedOrigins");
        f.setAccessible(true);
        f.set(config, origins);

        CapturingCorsRegistry registry = new CapturingCorsRegistry();
        config.corsConfigurer().addCorsMappings(registry);

        CorsConfiguration cors = registry.capture().get("/api/**");
        assertNotNull(cors, "CORS mapping for /api/** must be registered");
        // Regression guard: before the fix this was a single element
        // ["https://paths.games,https://www.paths.games,https://test.paths.games"]
        assertEquals(origins, cors.getAllowedOriginPatterns());
        assertTrue(cors.getAllowedOriginPatterns().contains("https://test.paths.games"));
    }

    /** Exposes the protected CorsRegistry#getCorsConfigurations() for assertions. */
    private static final class CapturingCorsRegistry extends CorsRegistry {
        Map<String, CorsConfiguration> capture() {
            return getCorsConfigurations();
        }
    }

}
