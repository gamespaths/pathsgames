package games.paths.launcher.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

/** v0.41.0 — decision 5: the committed JWT secrets are refused outside dev/test. */
class StartupSecretsGuardTest {

    private static final String PRIVATE = "a-private-random-secret-of-at-least-32-chars!!";

    @ParameterizedTest
    @ValueSource(strings = {"dev", "development", "test"})
    void devAndTestAcceptTheCommittedDefault(String env) {
        assertDoesNotThrow(() -> new StartupSecretsGuard(env, StartupSecretsGuard.YAML_DEFAULT));
        assertDoesNotThrow(() -> StartupSecretsGuard.check(env, StartupSecretsGuard.PROVIDER_DEFAULT));
    }

    @ParameterizedTest
    @ValueSource(strings = {"production", "prod", "alpha", "beta", ""})
    void productionRefusesEveryCommittedDefault(String env) {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> new StartupSecretsGuard(env, StartupSecretsGuard.YAML_DEFAULT));
        assertTrue(e.getMessage().contains("JWT_SECRET"));
        assertThrows(IllegalStateException.class,
                () -> StartupSecretsGuard.check(env, StartupSecretsGuard.PROVIDER_DEFAULT));
        assertThrows(IllegalStateException.class, () -> StartupSecretsGuard.check(env, " "));
        assertThrows(IllegalStateException.class, () -> StartupSecretsGuard.check(env, null));
    }

    @Test
    void productionStartsWithAPrivateSecret() {
        assertDoesNotThrow(() -> new StartupSecretsGuard("production", PRIVATE));
        assertThrows(IllegalStateException.class, () -> StartupSecretsGuard.check(null, null));
    }
}
