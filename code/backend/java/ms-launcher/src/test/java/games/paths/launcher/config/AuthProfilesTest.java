package games.paths.launcher.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * v1.2.0 the fake Google provider follows the test endpoints: off in the prod and test-stage profiles,
 * and the Google sign-in defaults of application.yml.
 */
class AuthProfilesTest {

    private static Object property(String file, String key) throws IOException {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader().load(file, new ClassPathResource(file));
        return sources.get(0).getProperty(key);
    }

    @Test
    void fakeProviderIsOffInTheProdProfiles() throws IOException {
        assertEquals(false, property("application-prod.yml", "game.dev.test-endpoints-enabled"));
        assertEquals(false, property("application-test.yml", "game.dev.test-endpoints-enabled"));
    }

    @Test
    void googleDefaults() throws IOException {
        assertEquals("${GOOGLE_ENABLED:true}", property("application.yml", "game.auth.google.enabled"));
        assertTrue(String.valueOf(property("application.yml", "game.auth.public-paths")).contains("/api/auth/google"));
        assertEquals("${RATE_LIMIT_GOOGLE_PER_IP:30}", property("application.yml",
                "game.security.rate-limit.google-per-ip"));
    }
}
