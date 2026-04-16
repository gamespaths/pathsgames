package games.paths.adapters.rest.cookie;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link CookiePolicyInitializer}.
 * Verifies that {@code init()} delegates to {@link CookieHelper#configure(String)}.
 */
class CookiePolicyInitializerTest {

    @Test
    @DisplayName("init() should configure CookieHelper with the sameSite value")
    void init_configuresCookieHelper() throws Exception {
        CookiePolicyInitializer initializer = new CookiePolicyInitializer();

        // Use reflection to set the @Value-injected sameSite field
        Field sameSiteField = CookiePolicyInitializer.class.getDeclaredField("sameSite");
        sameSiteField.setAccessible(true);
        sameSiteField.set(initializer, "Lax");

        // Call init (the @PostConstruct method)
        initializer.init();

        // Verify CookieHelper received the value by checking its static field
        Field helperSameSite = CookieHelper.class.getDeclaredField("sameSite");
        helperSameSite.setAccessible(true);
        assertEquals("Lax", helperSameSite.get(null));

        // Restore default to avoid side-effects on other tests
        CookieHelper.configure("None");
    }
}
