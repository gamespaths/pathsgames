package games.paths.launcher.config;

import games.paths.core.service.auth.SubjectHasher;
import games.paths.core.service.security.EnvironmentRule;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * StartupSecretsGuard - v0.41.0 (Step 41, decision 5): outside dev/test the server refuses to
 * start with a committed JWT secret (application.yml's or JwtTokenProvider's fallback).
 * v1.7.0 the same for the banned-subject pepper (BANNED_SUBJECT_PEPPER).
 */
@Component
public class StartupSecretsGuard {

    static final String YAML_DEFAULT = "PathsGamesDevSecret2026_MustBeAtLeast32Chars!";
    static final String PROVIDER_DEFAULT = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
    private static final Set<String> COMMITTED = Set.of(YAML_DEFAULT, PROVIDER_DEFAULT);

    public StartupSecretsGuard(
            @Value("${game.server.env:}") String env,
            @Value("${game.auth.jwt.secret:" + PROVIDER_DEFAULT + "}") String jwtSecret,
            @Value("${game.auth.banned-subject-pepper:" + SubjectHasher.DEFAULT_PEPPER + "}") String pepper) {
        check(env, jwtSecret);
        checkPepper(env, pepper);
    }

    /** v1.7.0 throws when a non dev/test environment runs with a blank or committed pepper. */
    static void checkPepper(String env, String pepper) {
        if (EnvironmentRule.isDevOrTest(env)) {
            return;
        }
        if (pepper == null || pepper.isBlank() || SubjectHasher.DEFAULT_PEPPER.equals(pepper)) {
            throw new IllegalStateException("Refusing to start: environment '" + env
                    + "' is not dev/test and BANNED_SUBJECT_PEPPER is missing or the committed default."
                    + " Set BANNED_SUBJECT_PEPPER to a private random value (openssl rand -base64 48).");
        }
    }

    /** Throws when a non dev/test environment runs with a blank or committed secret. */
    static void check(String env, String jwtSecret) {
        if (EnvironmentRule.isDevOrTest(env)) {
            return;
        }
        if (jwtSecret == null || jwtSecret.isBlank() || COMMITTED.contains(jwtSecret)) {
            throw new IllegalStateException("Refusing to start: environment '" + env
                    + "' is not dev/test and JWT_SECRET is missing or the committed default."
                    + " Set JWT_SECRET to a private random value (openssl rand -base64 48).");
        }
    }
}
