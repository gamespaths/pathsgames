package games.paths.core.service.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** v0.41.0 — decision 25: only dev, development and test are dev/test. */
class EnvironmentRuleTest {

    @ParameterizedTest
    @ValueSource(strings = {"dev", "development", "test", " TEST ", "Development"})
    void devAndTestNames(String env) {
        assertTrue(EnvironmentRule.isDevOrTest(env));
    }

    @ParameterizedTest
    @ValueSource(strings = {"prod", "production", "alpha", "beta", "unknown", "", "  ", "testing"})
    void everythingElseIsProduction(String env) {
        assertFalse(EnvironmentRule.isDevOrTest(env));
    }

    @Test
    void nullIsProduction() {
        assertFalse(EnvironmentRule.isDevOrTest(null));
    }
}
