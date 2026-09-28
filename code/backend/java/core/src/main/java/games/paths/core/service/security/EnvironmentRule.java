package games.paths.core.service.security;

import java.util.Locale;
import java.util.Set;

/**
 * EnvironmentRule - v0.41.0 (Step 41, decision 25): only dev, development and test are dev/test.
 * Anything else, a blank or a missing value included, is treated as production.
 */
public final class EnvironmentRule {

    private static final Set<String> DEV_OR_TEST = Set.of("dev", "development", "test");

    private EnvironmentRule() {
    }

    public static boolean isDevOrTest(String env) {
        return env != null && DEV_OR_TEST.contains(env.trim().toLowerCase(Locale.ROOT));
    }
}
